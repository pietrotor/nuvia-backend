ALTER TABLE "conversations" ADD COLUMN "bot_paused_at" timestamp with time zone;
--> statement-breakpoint
UPDATE "conversations"
SET "bot_paused_at" = COALESCE("updated_at", "last_activity_at")
WHERE "bot_paused" = true AND "bot_paused_at" IS NULL;
--> statement-breakpoint
ALTER TABLE "business_configs"
ADD COLUMN "agent_policy" jsonb DEFAULT '{"handoffAutoResumeMinutes":60}'::jsonb NOT NULL;
--> statement-breakpoint
ALTER TABLE "business_configs" ALTER COLUMN "agent_policy" DROP DEFAULT;
