ALTER TABLE "services" ADD COLUMN "description" text;--> statement-breakpoint
ALTER TABLE "services" ADD COLUMN "keywords" text[] DEFAULT '{}'::text[] NOT NULL;
