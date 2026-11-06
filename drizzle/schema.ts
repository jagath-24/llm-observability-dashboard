import { decimal, int, mysqlEnum, mysqlTable, text, timestamp, varchar } from "drizzle-orm/mysql-core";

export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export const llmCalls = mysqlTable("llm_calls", {
  id: int("id").autoincrement().primaryKey(),
  traceId: varchar("traceId", { length: 64 }).notNull(),
  provider: varchar("provider", { length: 32 }).notNull().default("groq"),
  model: varchar("model", { length: 128 }).notNull(),
  service: varchar("service", { length: 128 }).notNull(),
  endpoint: varchar("endpoint", { length: 255 }).notNull(),
  prompt: text("prompt").notNull(),
  response: text("response"),
  latencyMs: int("latencyMs").notNull(),
  promptTokens: int("promptTokens").notNull().default(0),
  completionTokens: int("completionTokens").notNull().default(0),
  totalTokens: int("totalTokens").notNull().default(0),
  estimatedCost: decimal("estimatedCost", { precision: 12, scale: 8 }).notNull().default("0"),
  status: mysqlEnum("status", ["success", "error"]).notNull().default("success"),
  errorMessage: text("errorMessage"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;
export type LlmCall = typeof llmCalls.$inferSelect;
export type InsertLlmCall = typeof llmCalls.$inferInsert;
