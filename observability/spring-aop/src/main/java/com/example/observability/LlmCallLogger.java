package com.example.observability;

public interface LlmCallLogger {
    void record(LlmCallLog call);
}
