ALTER TABLE "appointments" ADD COLUMN "deposit_receipt_storage_key" text;--> statement-breakpoint
ALTER TABLE "appointments" ADD COLUMN "deposit_receipt_mime_type" varchar(100);--> statement-breakpoint
ALTER TABLE "appointments" ADD COLUMN "deposit_receipt_received_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "appointments" ADD COLUMN "deposit_receipt_provider_message_id" varchar(255);--> statement-breakpoint
ALTER TABLE "appointments" ADD COLUMN "deposit_verified_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "appointments" ADD COLUMN "deposit_verified_by_user_id" uuid;--> statement-breakpoint
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_deposit_verified_by_user_id_users_id_fk" FOREIGN KEY ("deposit_verified_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "appointments_deposit_verified_by_idx" ON "appointments" USING btree ("deposit_verified_by_user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "appointments_deposit_receipt_provider_message_uq" ON "appointments" USING btree ("tenant_id","deposit_receipt_provider_message_id") WHERE "appointments"."deposit_receipt_provider_message_id" is not null;--> statement-breakpoint
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_complete_deposit_receipt" CHECK (("appointments"."deposit_receipt_storage_key" is null and "appointments"."deposit_receipt_mime_type" is null and "appointments"."deposit_receipt_received_at" is null)
        or ("appointments"."deposit_receipt_storage_key" is not null and "appointments"."deposit_receipt_mime_type" is not null and "appointments"."deposit_receipt_received_at" is not null));