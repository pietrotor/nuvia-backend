CREATE TYPE "public"."appointment_notification_delivery_status" AS ENUM('pending', 'deferred', 'dispatching', 'accepted', 'delivered', 'failed', 'unknown', 'suppressed');--> statement-breakpoint
CREATE TYPE "public"."appointment_notification_kind" AS ENUM('booked', 'rescheduled', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."notification_contact_status" AS ENUM('pending', 'active', 'paused', 'deactivated');--> statement-breakpoint
CREATE TABLE "appointment_notification_deliveries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"event_id" uuid NOT NULL,
	"contact_id" uuid NOT NULL,
	"destination_phone_e164" varchar(20) NOT NULL,
	"rendered_content" text,
	"status" "appointment_notification_delivery_status" DEFAULT 'pending' NOT NULL,
	"attempt_count" integer DEFAULT 0 NOT NULL,
	"next_attempt_at" timestamp with time zone NOT NULL,
	"lease_until" timestamp with time zone,
	"provider_message_id" varchar(255),
	"accepted_at" timestamp with time zone,
	"delivered_at" timestamp with time zone,
	"failed_at" timestamp with time zone,
	"last_error_code" varchar(64),
	"last_error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "appointment_notification_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"appointment_id" uuid NOT NULL,
	"sequence" integer NOT NULL,
	"kind" "appointment_notification_kind" NOT NULL,
	"previous_professional_id" uuid,
	"previous_branch_id" uuid,
	"previous_starts_at" timestamp with time zone,
	"previous_ends_at" timestamp with time zone,
	"current_professional_id" uuid NOT NULL,
	"current_branch_id" uuid NOT NULL,
	"current_starts_at" timestamp with time zone NOT NULL,
	"current_ends_at" timestamp with time zone NOT NULL,
	"occurred_at" timestamp with time zone NOT NULL,
	"expanded_at" timestamp with time zone,
	"attempt_count" integer DEFAULT 0 NOT NULL,
	"next_attempt_at" timestamp with time zone NOT NULL,
	"last_error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "appointment_notification_subscriptions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"contact_id" uuid NOT NULL,
	"professional_id" uuid,
	"branch_id" uuid,
	"enabled_at" timestamp with time zone NOT NULL,
	"disabled_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "appointment_notification_subscriptions_one_scope" CHECK (num_nonnulls("appointment_notification_subscriptions"."professional_id", "appointment_notification_subscriptions"."branch_id") = 1)
);
--> statement-breakpoint
CREATE TABLE "notification_contacts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"display_name" varchar(255) NOT NULL,
	"phone_e164" varchar(20) NOT NULL,
	"status" "notification_contact_status" DEFAULT 'pending' NOT NULL,
	"activation_code_hash" varchar(64),
	"activation_expires_at" timestamp with time zone,
	"activation_provider_message_id" varchar(255),
	"activated_at" timestamp with time zone,
	"paused_at" timestamp with time zone,
	"deactivated_at" timestamp with time zone,
	"last_inbound_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "appointment_notification_events_tenant_id_uq" ON "appointment_notification_events" USING btree ("tenant_id","id");--> statement-breakpoint
CREATE UNIQUE INDEX "notification_contacts_tenant_id_uq" ON "notification_contacts" USING btree ("tenant_id","id");--> statement-breakpoint
ALTER TABLE "appointment_notification_deliveries" ADD CONSTRAINT "appointment_notification_deliveries_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "appointment_notification_deliveries" ADD CONSTRAINT "appointment_notification_deliveries_event_id_appointment_notification_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."appointment_notification_events"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "appointment_notification_deliveries" ADD CONSTRAINT "appointment_notification_deliveries_contact_id_notification_contacts_id_fk" FOREIGN KEY ("contact_id") REFERENCES "public"."notification_contacts"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "appointment_notification_deliveries" ADD CONSTRAINT "appointment_notification_deliveries_event_fk" FOREIGN KEY ("tenant_id","event_id") REFERENCES "public"."appointment_notification_events"("tenant_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "appointment_notification_deliveries" ADD CONSTRAINT "appointment_notification_deliveries_contact_fk" FOREIGN KEY ("tenant_id","contact_id") REFERENCES "public"."notification_contacts"("tenant_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "appointment_notification_events" ADD CONSTRAINT "appointment_notification_events_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "appointment_notification_events" ADD CONSTRAINT "appointment_notification_events_appointment_id_appointments_id_fk" FOREIGN KEY ("appointment_id") REFERENCES "public"."appointments"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "appointment_notification_subscriptions" ADD CONSTRAINT "appointment_notification_subscriptions_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "appointment_notification_subscriptions" ADD CONSTRAINT "appointment_notification_subscriptions_contact_id_notification_contacts_id_fk" FOREIGN KEY ("contact_id") REFERENCES "public"."notification_contacts"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "appointment_notification_subscriptions" ADD CONSTRAINT "appointment_notification_subscriptions_professional_id_professionals_id_fk" FOREIGN KEY ("professional_id") REFERENCES "public"."professionals"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "appointment_notification_subscriptions" ADD CONSTRAINT "appointment_notification_subscriptions_branch_id_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "appointment_notification_subscriptions" ADD CONSTRAINT "appointment_notification_subscriptions_contact_fk" FOREIGN KEY ("tenant_id","contact_id") REFERENCES "public"."notification_contacts"("tenant_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_contacts" ADD CONSTRAINT "notification_contacts_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "appointment_notification_deliveries_tenant_id_uq" ON "appointment_notification_deliveries" USING btree ("tenant_id","id");--> statement-breakpoint
CREATE UNIQUE INDEX "appointment_notification_deliveries_event_contact_uq" ON "appointment_notification_deliveries" USING btree ("tenant_id","event_id","contact_id");--> statement-breakpoint
CREATE UNIQUE INDEX "appointment_notification_deliveries_provider_uq" ON "appointment_notification_deliveries" USING btree ("tenant_id","provider_message_id") WHERE "appointment_notification_deliveries"."provider_message_id" is not null;--> statement-breakpoint
CREATE INDEX "appointment_notification_deliveries_due_idx" ON "appointment_notification_deliveries" USING btree ("tenant_id","status","next_attempt_at") WHERE "appointment_notification_deliveries"."status" in ('pending', 'deferred');--> statement-breakpoint
CREATE INDEX "appointment_notification_deliveries_contact_idx" ON "appointment_notification_deliveries" USING btree ("tenant_id","contact_id");--> statement-breakpoint
CREATE UNIQUE INDEX "appointment_notification_events_sequence_uq" ON "appointment_notification_events" USING btree ("tenant_id","appointment_id","sequence");--> statement-breakpoint
CREATE INDEX "appointment_notification_events_unexpanded_idx" ON "appointment_notification_events" USING btree ("tenant_id","next_attempt_at") WHERE "appointment_notification_events"."expanded_at" is null;--> statement-breakpoint
CREATE INDEX "appointment_notification_events_appointment_idx" ON "appointment_notification_events" USING btree ("tenant_id","appointment_id","occurred_at");--> statement-breakpoint
CREATE UNIQUE INDEX "appointment_notification_subscriptions_tenant_id_uq" ON "appointment_notification_subscriptions" USING btree ("tenant_id","id");--> statement-breakpoint
CREATE UNIQUE INDEX "appointment_notification_subscriptions_professional_uq" ON "appointment_notification_subscriptions" USING btree ("tenant_id","contact_id","professional_id") WHERE "appointment_notification_subscriptions"."professional_id" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "appointment_notification_subscriptions_branch_uq" ON "appointment_notification_subscriptions" USING btree ("tenant_id","contact_id","branch_id") WHERE "appointment_notification_subscriptions"."branch_id" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "appointment_notification_subscriptions_professional_active_uq" ON "appointment_notification_subscriptions" USING btree ("tenant_id","professional_id") WHERE "appointment_notification_subscriptions"."professional_id" is not null and "appointment_notification_subscriptions"."disabled_at" is null;--> statement-breakpoint
CREATE INDEX "appointment_notification_subscriptions_professional_idx" ON "appointment_notification_subscriptions" USING btree ("tenant_id","professional_id") WHERE "appointment_notification_subscriptions"."disabled_at" is null;--> statement-breakpoint
CREATE INDEX "appointment_notification_subscriptions_branch_idx" ON "appointment_notification_subscriptions" USING btree ("tenant_id","branch_id") WHERE "appointment_notification_subscriptions"."disabled_at" is null;--> statement-breakpoint
CREATE UNIQUE INDEX "notification_contacts_tenant_phone_uq" ON "notification_contacts" USING btree ("tenant_id","phone_e164");--> statement-breakpoint
CREATE INDEX "notification_contacts_tenant_status_idx" ON "notification_contacts" USING btree ("tenant_id","status") WHERE "notification_contacts"."status" in ('pending', 'active', 'paused');