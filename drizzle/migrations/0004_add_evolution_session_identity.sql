ALTER TABLE "business_configs"
ADD COLUMN "evolution_instance_name" varchar(255);--> statement-breakpoint

ALTER TABLE "business_configs"
ADD COLUMN "evolution_webhook_token_hash" varchar(64);--> statement-breakpoint

CREATE UNIQUE INDEX "business_configs_evolution_instance_name_uq"
ON "business_configs" USING btree ("evolution_instance_name")
WHERE "evolution_instance_name" IS NOT NULL;