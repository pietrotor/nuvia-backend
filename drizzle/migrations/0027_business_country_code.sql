ALTER TABLE "business_configs" ADD COLUMN "country_code" varchar(2) DEFAULT 'BO' NOT NULL;

UPDATE "business_configs" SET "country_code" = 'BO' WHERE "country_code" IS NULL;
