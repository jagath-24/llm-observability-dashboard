package com.example.observability;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

@Component
public class JdbcTemplateLlmCallLogger implements LlmCallLogger {
    private final JdbcTemplate jdbcTemplate;

    public JdbcTemplateLlmCallLogger(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    @Override
    public void record(LlmCallLog call) {
        jdbcTemplate.update("""
            INSERT INTO llm_calls
              (traceId, provider, model, service, endpoint, prompt, response, latencyMs,
               promptTokens, completionTokens, totalTokens, estimatedCost, status, errorMessage, createdAt)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            call.traceId(), call.provider(), call.model(), call.service(), call.endpoint(),
            call.prompt(), call.response(), call.latencyMs(), call.promptTokens(),
            call.completionTokens(), call.totalTokens(), call.estimatedCost(), call.status(),
            call.errorMessage(), call.createdAt());
    }
}
