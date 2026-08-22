CREATE TYPE "public"."booking_question_kind" AS ENUM('text', 'yes_no');--> statement-breakpoint
CREATE TABLE "service_booking_questions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"service_id" uuid NOT NULL,
	"prompt" varchar(500) NOT NULL,
	"kind" "booking_question_kind" NOT NULL,
	"is_required" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "appointment_booking_answers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"appointment_id" uuid NOT NULL,
	"question_id" uuid,
	"prompt_snapshot" varchar(500) NOT NULL,
	"kind" "booking_question_kind" NOT NULL,
	"value" varchar(1000) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DROP INDEX "clients_tenant_phone_uq";--> statement-breakpoint
ALTER TABLE "clients" ALTER COLUMN "name" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "clients" ALTER COLUMN "phone_e164" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "clients" ADD COLUMN "whatsapp_profile_name" varchar(255);--> statement-breakpoint
UPDATE "clients"
SET
  "whatsapp_profile_name" = "name",
  "name" = NULL
WHERE "name" IS NOT NULL AND "name" ~* '^cliente\b';--> statement-breakpoint
ALTER TABLE "appointments" ADD COLUMN "booking_contact_client_id" uuid;--> statement-breakpoint
UPDATE "appointments" SET "booking_contact_client_id" = "client_id" WHERE "booking_contact_client_id" IS NULL;--> statement-breakpoint
ALTER TABLE "appointments" ALTER COLUMN "booking_contact_client_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "appointment_booking_answers" ADD CONSTRAINT "appointment_booking_answers_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "appointment_booking_answers" ADD CONSTRAINT "appointment_booking_answers_appointment_id_appointments_id_fk" FOREIGN KEY ("appointment_id") REFERENCES "public"."appointments"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "appointment_booking_answers" ADD CONSTRAINT "appointment_booking_answers_question_id_service_booking_questions_id_fk" FOREIGN KEY ("question_id") REFERENCES "public"."service_booking_questions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service_booking_questions" ADD CONSTRAINT "service_booking_questions_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service_booking_questions" ADD CONSTRAINT "service_booking_questions_service_id_services_id_fk" FOREIGN KEY ("service_id") REFERENCES "public"."services"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "appointment_booking_answers_appointment_idx" ON "appointment_booking_answers" USING btree ("tenant_id","appointment_id");--> statement-breakpoint
CREATE INDEX "service_booking_questions_service_idx" ON "service_booking_questions" USING btree ("tenant_id","service_id");--> statement-breakpoint
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_booking_contact_client_id_clients_id_fk" FOREIGN KEY ("booking_contact_client_id") REFERENCES "public"."clients"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "appointments_booking_contact_idx" ON "appointments" USING btree ("booking_contact_client_id");--> statement-breakpoint
CREATE UNIQUE INDEX "clients_tenant_phone_uq" ON "clients" USING btree ("tenant_id","phone_e164") WHERE "clients"."phone_e164" is not null;
