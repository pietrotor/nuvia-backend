CREATE TYPE "public"."agent_trace_outcome" AS ENUM('answered', 'max_rounds', 'handoff_claims', 'handoff_schedule', 'failed', 'skipped_paused', 'skipped_quota', 'skipped_superseded', 'skipped_non_text');--> statement-breakpoint
CREATE TABLE "agent_traces" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"conversation_id" uuid NOT NULL,
	"trigger_provider_message_id" varchar(255) NOT NULL,
	"inbound_text" text,
	"final_text" text,
	"prompt_fingerprint" varchar(64),
	"static_prompt" text,
	"volatile_prompt" text,
	"outcome" "agent_trace_outcome" NOT NULL,
	"rounds" integer DEFAULT 0 NOT NULL,
	"tool_calls" integer DEFAULT 0 NOT NULL,
	"error_count" integer DEFAULT 0 NOT NULL,
	"duration_ms" integer DEFAULT 0 NOT NULL,
	"steps" jsonb NOT NULL,
	"started_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "agent_traces" ADD CONSTRAINT "agent_traces_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_traces" ADD CONSTRAINT "agent_traces_conversation_id_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "agent_traces_tenant_idx" ON "agent_traces" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "agent_traces_tenant_started_idx" ON "agent_traces" USING btree ("tenant_id","started_at");--> statement-breakpoint
CREATE INDEX "agent_traces_conversation_started_idx" ON "agent_traces" USING btree ("conversation_id","started_at");--> statement-breakpoint
CREATE INDEX "agent_traces_tenant_outcome_idx" ON "agent_traces" USING btree ("tenant_id","outcome");--> statement-breakpoint
CREATE UNIQUE INDEX "agent_traces_tenant_trigger_uq" ON "agent_traces" USING btree ("tenant_id","trigger_provider_message_id");