CREATE TYPE "public"."currency" AS ENUM('BOB', 'USD');
--> statement-breakpoint
ALTER TABLE "business_configs"
ADD COLUMN "currency" "currency" DEFAULT 'BOB' NOT NULL;
--> statement-breakpoint
ALTER TABLE "services" RENAME COLUMN "price_bs" TO "price";
--> statement-breakpoint
ALTER TABLE "services" RENAME COLUMN "deposit_amount_bs" TO "deposit_amount";
--> statement-breakpoint
ALTER TABLE "services"
ADD COLUMN "currency" "currency" DEFAULT 'BOB' NOT NULL;
--> statement-breakpoint
ALTER TABLE "services" ALTER COLUMN "currency" DROP DEFAULT;
