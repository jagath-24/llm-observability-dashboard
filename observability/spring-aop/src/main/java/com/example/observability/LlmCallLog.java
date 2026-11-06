package com.example.observability;

import java.math.BigDecimal;
import java.time.Instant;

public record LlmCallLog(
        String traceId,
        String provider,
        String model,
        String service,
        String endpoint,
        String prompt,
        String response,
        long latencyMs,
        int promptTokens,
        int completionTokens,
        int totalTokens,
        BigDecimal estimatedCost,
        String status,
        String errorMessage,
        Instant createdAt
) {}
