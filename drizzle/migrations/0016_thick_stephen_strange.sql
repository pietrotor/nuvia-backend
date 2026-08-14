ALTER TABLE "clients" ADD COLUMN "email" varchar(320);--> statement-breakpoint
ALTER TABLE "clients" ADD COLUMN "birth_date" date;--> statement-breakpoint
ALTER TABLE "clients" ADD COLUMN "identification_type" varchar(50);--> statement-breakpoint
ALTER TABLE "clients" ADD COLUMN "identification_number" varchar(100);--> statement-breakpoint
ALTER TABLE "clients" ADD COLUMN "address" text;