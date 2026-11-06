package com.example.observability;

import java.math.BigDecimal;
import java.math.RoundingMode;

public final class TokenCostEstimator {
    private static final BigDecimal INPUT_PER_1K = new BigDecimal("0.005");
    private static final BigDecimal OUTPUT_PER_1K = new BigDecimal("0.015");

    private TokenCostEstimator() {}

    public static int estimateTokens(String value) {
        if (value == null || value.isBlank()) return 0;
        return Math.max(1, (int) Math.ceil(value.trim().split("\\s+").length * 1.33));
    }

    public static BigDecimal estimateCost(int promptTokens, int completionTokens) {
        BigDecimal input = BigDecimal.valueOf(promptTokens).divide(BigDecimal.valueOf(1000), 8, RoundingMode.HALF_UP).multiply(INPUT_PER_1K);
        BigDecimal output = BigDecimal.valueOf(completionTokens).divide(BigDecimal.valueOf(1000), 8, RoundingMode.HALF_UP).multiply(OUTPUT_PER_1K);
        return input.add(output).setScale(6, RoundingMode.HALF_UP);
    }
}
