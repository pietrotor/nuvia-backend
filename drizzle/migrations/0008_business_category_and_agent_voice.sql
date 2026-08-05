CREATE TYPE "public"."business_category" AS ENUM('default', 'esthetics', 'spa', 'beauty');
--> statement-breakpoint
ALTER TABLE "business_configs"
ADD COLUMN "business_category" "business_category" DEFAULT 'default' NOT NULL;
--> statement-breakpoint
UPDATE "business_configs"
SET "agent_policy" = "agent_policy" || '{"emojiPolicy":"light","businessNotes":null}'::jsonb
WHERE NOT ("agent_policy" ? 'emojiPolicy');
--> statement-breakpoint
ALTER TABLE "messages" ADD COLUMN "prompt_fingerprint" varchar(64);
