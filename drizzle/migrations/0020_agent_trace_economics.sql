ALTER TYPE "public"."agent_trace_outcome" ADD VALUE IF NOT EXISTS 'short_circuit_greeting';--> statement-breakpoint
ALTER TABLE "agent_traces" ADD COLUMN IF NOT EXISTS "llm_calls" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "agent_traces" ADD COLUMN IF NOT EXISTS "prompt_tokens_total" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "agent_traces" ADD COLUMN IF NOT EXISTS "completion_tokens_total" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "agent_traces" ADD COLUMN IF NOT EXISTS "cached_prompt_tokens_total" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "agent_traces" ADD COLUMN IF NOT EXISTS "cache_write_tokens_total" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "agent_traces" ADD COLUMN IF NOT EXISTS "cost_credits_total" numeric(16, 8);
