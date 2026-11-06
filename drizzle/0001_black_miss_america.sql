CREATE TABLE `llm_calls` (
	`id` int AUTO_INCREMENT NOT NULL,
	`traceId` varchar(64) NOT NULL,
	`provider` varchar(32) NOT NULL DEFAULT 'groq',
	`model` varchar(128) NOT NULL,
	`service` varchar(128) NOT NULL,
	`endpoint` varchar(255) NOT NULL,
	`prompt` text NOT NULL,
	`response` text,
	`latencyMs` int NOT NULL,
	`promptTokens` int NOT NULL DEFAULT 0,
	`completionTokens` int NOT NULL DEFAULT 0,
	`totalTokens` int NOT NULL DEFAULT 0,
	`estimatedCost` decimal(12,8) NOT NULL DEFAULT '0',
	`status` enum('success','error') NOT NULL DEFAULT 'success',
	`errorMessage` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `llm_calls_id` PRIMARY KEY(`id`)
);
