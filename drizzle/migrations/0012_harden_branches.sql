ALTER TABLE "appointments" DROP CONSTRAINT "appointments_non_negative_price";--> statement-breakpoint
ALTER TABLE "appointments" ALTER COLUMN "branch_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "appointments" ALTER COLUMN "price" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "appointments" ALTER COLUMN "currency" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "business_configs" DROP COLUMN "address";--> statement-breakpoint
ALTER TABLE "business_configs" DROP COLUMN "business_hours";--> statement-breakpoint
ALTER TABLE "professionals" DROP COLUMN "weekly_hours";--> statement-breakpoint
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_non_negative_price" CHECK ("appointments"."price" >= 0);