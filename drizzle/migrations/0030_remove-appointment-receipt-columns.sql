ALTER TABLE "appointments" DROP CONSTRAINT "appointments_complete_deposit_receipt";--> statement-breakpoint
DROP INDEX "appointments_deposit_receipt_provider_message_uq";--> statement-breakpoint
ALTER TABLE "appointments" DROP COLUMN "deposit_receipt_storage_key";--> statement-breakpoint
ALTER TABLE "appointments" DROP COLUMN "deposit_receipt_mime_type";--> statement-breakpoint
ALTER TABLE "appointments" DROP COLUMN "deposit_receipt_received_at";--> statement-breakpoint
ALTER TABLE "appointments" DROP COLUMN "deposit_receipt_provider_message_id";