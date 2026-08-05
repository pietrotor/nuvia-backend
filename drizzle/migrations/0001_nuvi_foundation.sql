CREATE TYPE "public"."agent_tone" AS ENUM('formal', 'warm');--> statement-breakpoint
CREATE TYPE "public"."appointment_status" AS ENUM('pending_deposit', 'confirmed', 'attended', 'no_show', 'cancelled', 'released');--> statement-breakpoint
CREATE TABLE "business_configs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"slug" varchar(100) NOT NULL,
	"agent_name" varchar(100) DEFAULT 'Vale' NOT NULL,
	"tone" "agent_tone" DEFAULT 'warm' NOT NULL,
	"address" text,
	"logo_url" text,
	"whatsapp_phone" varchar(20),
	"business_hours" jsonb NOT NULL,
	"booking_policy" jsonb NOT NULL,
	"faq" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"static_deposit_qr_url" text,
	"evolution_instance_id" varchar(255),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
CREATE TABLE "professionals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"name" varchar(255) NOT NULL,
	"weekly_hours" jsonb NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
CREATE TABLE "services" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"name" varchar(255) NOT NULL,
	"duration_minutes" integer NOT NULL,
	"price_bs" numeric(12, 2) NOT NULL,
	"requires_deposit" boolean DEFAULT false NOT NULL,
	"deposit_amount_bs" numeric(12, 2),
	"deposit_percent" integer,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
CREATE TABLE "professional_services" (
	"tenant_id" uuid NOT NULL,
	"professional_id" uuid NOT NULL,
	"service_id" uuid NOT NULL,
	CONSTRAINT "professional_services_professional_id_service_id_pk" PRIMARY KEY("professional_id","service_id")
);--> statement-breakpoint
CREATE TABLE "clients" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"name" varchar(255) NOT NULL,
	"phone_e164" varchar(20) NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
CREATE TABLE "schedule_blocks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"professional_id" uuid,
	"starts_at" timestamp with time zone NOT NULL,
	"ends_at" timestamp with time zone NOT NULL,
	"reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
CREATE TABLE "appointments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"client_id" uuid NOT NULL,
	"professional_id" uuid NOT NULL,
	"service_id" uuid NOT NULL,
	"starts_at" timestamp with time zone NOT NULL,
	"ends_at" timestamp with time zone NOT NULL,
	"status" "appointment_status" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
ALTER TABLE "business_configs" ADD CONSTRAINT "business_configs_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "professionals" ADD CONSTRAINT "professionals_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "services" ADD CONSTRAINT "services_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "professional_services" ADD CONSTRAINT "professional_services_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "professional_services" ADD CONSTRAINT "professional_services_professional_id_professionals_id_fk" FOREIGN KEY ("professional_id") REFERENCES "public"."professionals"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "professional_services" ADD CONSTRAINT "professional_services_service_id_services_id_fk" FOREIGN KEY ("service_id") REFERENCES "public"."services"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "clients" ADD CONSTRAINT "clients_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "schedule_blocks" ADD CONSTRAINT "schedule_blocks_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "schedule_blocks" ADD CONSTRAINT "schedule_blocks_professional_id_professionals_id_fk" FOREIGN KEY ("professional_id") REFERENCES "public"."professionals"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_professional_id_professionals_id_fk" FOREIGN KEY ("professional_id") REFERENCES "public"."professionals"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_service_id_services_id_fk" FOREIGN KEY ("service_id") REFERENCES "public"."services"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "business_configs_tenant_uq" ON "business_configs" USING btree ("tenant_id");--> statement-breakpoint
CREATE UNIQUE INDEX "business_configs_slug_uq" ON "business_configs" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "business_configs_tenant_idx" ON "business_configs" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "professionals_tenant_idx" ON "professionals" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "services_tenant_idx" ON "services" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "professional_services_tenant_idx" ON "professional_services" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "clients_tenant_idx" ON "clients" USING btree ("tenant_id");--> statement-breakpoint
CREATE UNIQUE INDEX "clients_tenant_phone_uq" ON "clients" USING btree ("tenant_id","phone_e164");--> statement-breakpoint
CREATE INDEX "schedule_blocks_tenant_idx" ON "schedule_blocks" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "schedule_blocks_professional_starts_idx" ON "schedule_blocks" USING btree ("professional_id","starts_at");--> statement-breakpoint
CREATE INDEX "appointments_tenant_idx" ON "appointments" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "appointments_professional_starts_idx" ON "appointments" USING btree ("professional_id","starts_at");--> statement-breakpoint
CREATE INDEX "appointments_active_slot_idx" ON "appointments" USING btree ("professional_id","starts_at","ends_at") WHERE "appointments"."status" in ('pending_deposit', 'confirmed');--> statement-breakpoint
ALTER TABLE "tenants" DROP CONSTRAINT IF EXISTS "tenants_payments_email_unique";--> statement-breakpoint
ALTER TABLE "tenants" DROP COLUMN IF EXISTS "vertical";--> statement-breakpoint
ALTER TABLE "tenants" DROP COLUMN IF EXISTS "vertical_template_id";--> statement-breakpoint
ALTER TABLE "tenants" DROP COLUMN IF EXISTS "send_window_config";--> statement-breakpoint
ALTER TABLE "tenants" DROP COLUMN IF EXISTS "whatsapp_phone";--> statement-breakpoint
ALTER TABLE "tenants" DROP COLUMN IF EXISTS "static_qr_url";--> statement-breakpoint
ALTER TABLE "tenants" DROP COLUMN IF EXISTS "payments_email";--> statement-breakpoint
DROP TYPE IF EXISTS "public"."vertical";
