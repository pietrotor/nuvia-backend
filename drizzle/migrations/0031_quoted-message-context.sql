DROP INDEX "messages_tenant_reply_uq";--> statement-breakpoint
ALTER TABLE "messages" ADD COLUMN "related_appointment_id" uuid;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_related_appointment_id_appointments_id_fk" FOREIGN KEY ("related_appointment_id") REFERENCES "public"."appointments"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "messages_related_appointment_idx" ON "messages" USING btree ("tenant_id","related_appointment_id");--> statement-breakpoint
CREATE UNIQUE INDEX "messages_tenant_reply_uq" ON "messages" USING btree ("tenant_id","in_reply_to_provider_message_id") WHERE "messages"."in_reply_to_provider_message_id" is not null and "messages"."direction" = 'outbound';