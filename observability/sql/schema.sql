-- LLM Observability Dashboard / MySQL schema
-- Pricing simulation: $0.005 / 1K input tokens, $0.015 / 1K output tokens.
CREATE TABLE IF NOT EXISTS llm_calls (
  id INT AUTO_INCREMENT PRIMARY KEY,
  traceId VARCHAR(64) NOT NULL,
  provider VARCHAR(32) NOT NULL DEFAULT 'groq',
  model VARCHAR(128) NOT NULL,
  service VARCHAR(128) NOT NULL,
  endpoint VARCHAR(255) NOT NULL,
  prompt TEXT NOT NULL,
  response TEXT,
  latencyMs INT NOT NULL,
  promptTokens INT NOT NULL DEFAULT 0,
  completionTokens INT NOT NULL DEFAULT 0,
  totalTokens INT NOT NULL DEFAULT 0,
  estimatedCost DECIMAL(12, 8) NOT NULL DEFAULT 0,
  status ENUM('success', 'error') NOT NULL DEFAULT 'success',
  errorMessage TEXT,
  createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_llm_calls_createdAt (createdAt),
  INDEX idx_llm_calls_service_endpoint (service, endpoint),
  INDEX idx_llm_calls_status (status)
);
