CREATE TYPE "public"."deposit_receipt_classification" AS ENUM('receipt', 'unknown', 'staff_upload');--> statement-breakpoint
CREATE TYPE "public"."deposit_receipt_expectation_status" AS ENUM('active', 'consumed', 'expired');--> statement-breakpoint
CREATE TYPE "public"."deposit_receipt_source" AS ENUM('whatsapp', 'staff');--> statement-breakpoint
CREATE TYPE "public"."deposit_receipt_status" AS ENUM('pending_assignment', 'assigned', 'superseded');--> statement-breakpoint
CREATE TABLE "deposit_receipt_expectations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"conversation_id" uuid NOT NULL,
	"client_id" uuid NOT NULL,
	"appointment_id" uuid NOT NULL,
	"status" "deposit_receipt_expectation_status" NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"resolved_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "deposit_receipts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"conversation_id" uuid,
	"client_id" uuid NOT NULL,
	"appointment_id" uuid,
	"provider_message_id" varchar(255),
	"storage_key" text NOT NULL,
	"mime_type" varchar(100) NOT NULL,
	"received_at" timestamp with time zone NOT NULL,
	"status" "deposit_receipt_status" NOT NULL,
	"source" "deposit_receipt_source" NOT NULL,
	"classification" "deposit_receipt_classification" NOT NULL,
	"superseded_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "deposit_receipts_assignment_consistency" CHECK (("deposit_receipts"."status" = 'pending_assignment' and "deposit_receipts"."appointment_id" is null and "deposit_receipts"."superseded_at" is null)
        or ("deposit_receipts"."status" = 'assigned' and "deposit_receipts"."appointment_id" is not null and "deposit_receipts"."superseded_at" is null)
        or ("deposit_receipts"."status" = 'superseded' and "deposit_receipts"."appointment_id" is not null and "deposit_receipts"."superseded_at" is not null))
);
--> statement-breakpoint
ALTER TABLE "deposit_receipt_expectations" ADD CONSTRAINT "deposit_receipt_expectations_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deposit_receipt_expectations" ADD CONSTRAINT "deposit_receipt_expectations_conversation_id_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deposit_receipt_expectations" ADD CONSTRAINT "deposit_receipt_expectations_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deposit_receipt_expectations" ADD CONSTRAINT "deposit_receipt_expectations_appointment_id_appointments_id_fk" FOREIGN KEY ("appointment_id") REFERENCES "public"."appointments"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deposit_receipts" ADD CONSTRAINT "deposit_receipts_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deposit_receipts" ADD CONSTRAINT "deposit_receipts_conversation_id_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deposit_receipts" ADD CONSTRAINT "deposit_receipts_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deposit_receipts" ADD CONSTRAINT "deposit_receipts_appointment_id_appointments_id_fk" FOREIGN KEY ("appointment_id") REFERENCES "public"."appointments"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "deposit_receipt_expectations_tenant_idx" ON "deposit_receipt_expectations" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "deposit_receipt_expectations_conversation_idx" ON "deposit_receipt_expectations" USING btree ("tenant_id","conversation_id");--> statement-breakpoint
CREATE UNIQUE INDEX "deposit_receipt_expectations_active_conversation_uq" ON "deposit_receipt_expectations" USING btree ("tenant_id","conversation_id") WHERE "deposit_receipt_expectations"."status" = 'active';--> statement-breakpoint
CREATE INDEX "deposit_receipts_tenant_idx" ON "deposit_receipts" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "deposit_receipts_conversation_received_idx" ON "deposit_receipts" USING btree ("tenant_id","conversation_id","received_at");--> statement-breakpoint
CREATE INDEX "deposit_receipts_client_received_idx" ON "deposit_receipts" USING btree ("tenant_id","client_id","received_at");--> statement-breakpoint
CREATE INDEX "deposit_receipts_appointment_idx" ON "deposit_receipts" USING btree ("tenant_id","appointment_id");--> statement-breakpoint
CREATE UNIQUE INDEX "deposit_receipts_provider_message_uq" ON "deposit_receipts" USING btree ("tenant_id","provider_message_id") WHERE "deposit_receipts"."provider_message_id" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "deposit_receipts_active_appointment_uq" ON "deposit_receipts" USING btree ("tenant_id","appointment_id") WHERE "deposit_receipts"."status" = 'assigned' and "deposit_receipts"."appointment_id" is not null;