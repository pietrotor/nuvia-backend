ALTER TABLE "business_configs" ADD COLUMN "client_reminder_policy" jsonb DEFAULT '{"enabled":true,"offsets":["24h","2h"],"thankYouAfterVisit":false}'::jsonb NOT NULL;--> statement-breakpoint
CREATE TYPE "public"."appointment_reminder_kind" AS ENUM('24h', '12h', '2h', '30m', 'thank_you');--> statement-breakpoint
CREATE TYPE "public"."appointment_reminder_status" AS ENUM('pending', 'deferred', 'dispatching', 'accepted', 'failed', 'unknown', 'suppressed', 'cancelled');--> statement-breakpoint
CREATE TABLE "appointment_reminders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"appointment_id" uuid NOT NULL,
	"kind" "appointment_reminder_kind" NOT NULL,
	"destination_phone_e164" varchar(20) NOT NULL,
	"rendered_content" text,
	"status" "appointment_reminder_status" DEFAULT 'pending' NOT NULL,
	"attempt_count" integer DEFAULT 0 NOT NULL,
	"next_attempt_at" timestamp with time zone NOT NULL,
	"lease_until" timestamp with time zone,
	"provider_message_id" varchar(255),
	"accepted_at" timestamp with time zone,
	"failed_at" timestamp with time zone,
	"last_error_code" varchar(64),
	"last_error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "appointment_reminders" ADD CONSTRAINT "appointment_reminders_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "appointment_reminders" ADD CONSTRAINT "appointment_reminders_appointment_id_appointments_id_fk" FOREIGN KEY ("appointment_id") REFERENCES "public"."appointments"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "appointment_reminders_tenant_id_uq" ON "appointment_reminders" USING btree ("tenant_id","id");--> statement-breakpoint
CREATE UNIQUE INDEX "appointment_reminders_appointment_kind_uq" ON "appointment_reminders" USING btree ("tenant_id","appointment_id","kind");--> statement-breakpoint
CREATE UNIQUE INDEX "appointment_reminders_provider_uq" ON "appointment_reminders" USING btree ("tenant_id","provider_message_id") WHERE "appointment_reminders"."provider_message_id" is not null;--> statement-breakpoint
CREATE INDEX "appointment_reminders_due_idx" ON "appointment_reminders" USING btree ("tenant_id","status","next_attempt_at") WHERE "appointment_reminders"."status" in ('pending', 'deferred');--> statement-breakpoint
CREATE INDEX "appointment_reminders_due_unscoped_idx" ON "appointment_reminders" USING btree ("next_attempt_at") WHERE "appointment_reminders"."status" in ('pending', 'deferred');--> statement-breakpoint
CREATE INDEX "appointment_reminders_lease_unscoped_idx" ON "appointment_reminders" USING btree ("lease_until") WHERE "appointment_reminders"."status" = 'dispatching';
