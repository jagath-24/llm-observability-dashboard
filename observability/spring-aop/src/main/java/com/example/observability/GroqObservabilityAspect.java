package com.example.observability;

import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.servlet.http.HttpServletRequest;
import org.aspectj.lang.ProceedingJoinPoint;
import org.aspectj.lang.annotation.Around;
import org.aspectj.lang.annotation.Aspect;
import org.springframework.stereotype.Component;
import org.springframework.web.context.request.RequestContextHolder;
import org.springframework.web.context.request.ServletRequestAttributes;

import java.time.Instant;
import java.util.UUID;

@Aspect
@Component
public class GroqObservabilityAspect {
    private final LlmCallLogger logger;
    private final ObjectMapper objectMapper;

    public GroqObservabilityAspect(LlmCallLogger logger, ObjectMapper objectMapper) {
        this.logger = logger;
        this.objectMapper = objectMapper;
    }

    @Around("@annotation(observed)")
    public Object observe(ProceedingJoinPoint joinPoint, LlmObserved observed) throws Throwable {
        long started = System.nanoTime();
        String prompt = serialize(joinPoint.getArgs());
        String endpoint = observed.endpoint().isBlank() ? currentEndpoint() : observed.endpoint();
        String traceId = "tr_" + UUID.randomUUID().toString().replace("-", "").substring(0, 10);

        try {
            Object result = joinPoint.proceed();
            String response = serialize(result);
            record(traceId, observed, endpoint, prompt, response, elapsedMs(started), "success", null);
            return result;
        } catch (Throwable error) {
            record(traceId, observed, endpoint, prompt, null, elapsedMs(started), "error", error.getMessage());
            throw error;
        }
    }

    private void record(String traceId, LlmObserved observed, String endpoint, String prompt, String response, long latencyMs, String status, String errorMessage) {
        int promptTokens = TokenCostEstimator.estimateTokens(prompt);
        int completionTokens = TokenCostEstimator.estimateTokens(response);
        logger.record(new LlmCallLog(traceId, observed.provider(), observed.model(), observed.service(), endpoint, prompt, response, latencyMs, promptTokens, completionTokens, promptTokens + completionTokens, TokenCostEstimator.estimateCost(promptTokens, completionTokens), status, errorMessage, Instant.now()));
    }

    private String serialize(Object value) {
        if (value == null) return null;
        if (value instanceof String text) return text;
        try { return objectMapper.writeValueAsString(value); }
        catch (Exception ignored) { return String.valueOf(value); }
    }

    private String currentEndpoint() {
        var attributes = RequestContextHolder.getRequestAttributes();
        if (attributes instanceof ServletRequestAttributes servlet) {
            HttpServletRequest request = servlet.getRequest();
            return request.getMethod() + " " + request.getRequestURI();
        }
        return "internal://llm-call";
    }

    private long elapsedMs(long started) {
        return Math.max(1, (System.nanoTime() - started) / 1_000_000);
    }
}
