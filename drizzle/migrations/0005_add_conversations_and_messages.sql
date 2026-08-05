CREATE TYPE "public"."message_direction" AS ENUM('inbound', 'outbound');--> statement-breakpoint
CREATE TYPE "public"."message_kind" AS ENUM('text', 'audio', 'image', 'other');--> statement-breakpoint

CREATE TABLE "conversations" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tenant_id" uuid NOT NULL,
  "client_id" uuid,
  "client_phone_e164" varchar(20) NOT NULL,
  "bot_paused" boolean DEFAULT false NOT NULL,
  "handoff_reason" text,
  "last_activity_at" timestamp with time zone NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint

CREATE TABLE "messages" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tenant_id" uuid NOT NULL,
  "conversation_id" uuid NOT NULL,
  "provider_message_id" varchar(255) NOT NULL,
  "in_reply_to_provider_message_id" varchar(255),
  "direction" "message_direction" NOT NULL,
  "kind" "message_kind" NOT NULL,
  "content" text,
  "occurred_at" timestamp with time zone NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint

ALTER TABLE "conversations" ADD CONSTRAINT "conversations_tenant_id_tenants_id_fk"
FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade;--> statement-breakpoint
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_client_id_clients_id_fk"
FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE restrict;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_tenant_id_tenants_id_fk"
FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_conversation_id_conversations_id_fk"
FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE cascade;--> statement-breakpoint

CREATE INDEX "conversations_tenant_idx" ON "conversations" ("tenant_id");--> statement-breakpoint
CREATE INDEX "conversations_client_idx" ON "conversations" ("client_id");--> statement-breakpoint
CREATE UNIQUE INDEX "conversations_tenant_phone_uq"
ON "conversations" ("tenant_id", "client_phone_e164");--> statement-breakpoint
CREATE INDEX "messages_tenant_idx" ON "messages" ("tenant_id");--> statement-breakpoint
CREATE INDEX "messages_conversation_occurred_idx"
ON "messages" ("conversation_id", "occurred_at");--> statement-breakpoint
CREATE UNIQUE INDEX "messages_tenant_provider_message_uq"
ON "messages" ("tenant_id", "provider_message_id");--> statement-breakpoint
CREATE UNIQUE INDEX "messages_tenant_reply_uq"
ON "messages" ("tenant_id", "in_reply_to_provider_message_id")
WHERE "in_reply_to_provider_message_id" IS NOT NULL;