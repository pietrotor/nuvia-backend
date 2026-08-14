CREATE TABLE "branches" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"name" varchar(255) NOT NULL,
	"slug" varchar(100) NOT NULL,
	"address" text,
	"maps_url" text,
	"phone" varchar(20),
	"weekly_hours" jsonb NOT NULL,
	"timezone" varchar(64),
	"is_primary" boolean DEFAULT false NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "branch_professionals" (
	"tenant_id" uuid NOT NULL,
	"branch_id" uuid NOT NULL,
	"professional_id" uuid NOT NULL,
	"weekly_hours" jsonb NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "branch_professionals_professional_id_branch_id_pk" PRIMARY KEY("professional_id","branch_id")
);
--> statement-breakpoint
CREATE TABLE "branch_services" (
	"tenant_id" uuid NOT NULL,
	"branch_id" uuid NOT NULL,
	"service_id" uuid NOT NULL,
	"price_override" numeric(12, 2),
	"deposit_amount_override" numeric(12, 2),
	"deposit_qr_id" uuid,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "branch_services_branch_id_service_id_pk" PRIMARY KEY("branch_id","service_id")
);
--> statement-breakpoint
CREATE TABLE "user_branches" (
	"tenant_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"branch_id" uuid NOT NULL,
	CONSTRAINT "user_branches_user_id_branch_id_pk" PRIMARY KEY("user_id","branch_id")
);
--> statement-breakpoint
ALTER TABLE "branches" ADD CONSTRAINT "branches_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "branch_professionals" ADD CONSTRAINT "branch_professionals_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "branch_professionals" ADD CONSTRAINT "branch_professionals_branch_id_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "branch_professionals" ADD CONSTRAINT "branch_professionals_professional_id_professionals_id_fk" FOREIGN KEY ("professional_id") REFERENCES "public"."professionals"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "branch_services" ADD CONSTRAINT "branch_services_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "branch_services" ADD CONSTRAINT "branch_services_branch_id_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "branch_services" ADD CONSTRAINT "branch_services_service_id_services_id_fk" FOREIGN KEY ("service_id") REFERENCES "public"."services"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "branch_services" ADD CONSTRAINT "branch_services_deposit_qr_id_deposit_qrs_id_fk" FOREIGN KEY ("deposit_qr_id") REFERENCES "public"."deposit_qrs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_branches" ADD CONSTRAINT "user_branches_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_branches" ADD CONSTRAINT "user_branches_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_branches" ADD CONSTRAINT "user_branches_branch_id_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "branches_tenant_idx" ON "branches" USING btree ("tenant_id");--> statement-breakpoint
CREATE UNIQUE INDEX "branches_tenant_slug_uq" ON "branches" USING btree ("tenant_id","slug");--> statement-breakpoint
CREATE UNIQUE INDEX "branches_tenant_primary_uq" ON "branches" USING btree ("tenant_id") WHERE "branches"."is_primary" and "branches"."is_active";--> statement-breakpoint
CREATE INDEX "branch_professionals_tenant_idx" ON "branch_professionals" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "branch_professionals_branch_idx" ON "branch_professionals" USING btree ("branch_id");--> statement-breakpoint
CREATE INDEX "branch_services_tenant_idx" ON "branch_services" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "branch_services_service_idx" ON "branch_services" USING btree ("service_id");--> statement-breakpoint
CREATE INDEX "user_branches_tenant_idx" ON "user_branches" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "user_branches_branch_idx" ON "user_branches" USING btree ("branch_id");--> statement-breakpoint
ALTER TABLE "appointments" ADD COLUMN "branch_id" uuid;--> statement-breakpoint
ALTER TABLE "appointments" ADD COLUMN "price" numeric(12, 2);--> statement-breakpoint
ALTER TABLE "appointments" ADD COLUMN "currency" "currency";--> statement-breakpoint
ALTER TABLE "appointments" ADD COLUMN "deposit_amount" numeric(12, 2);--> statement-breakpoint
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_non_negative_price" CHECK ("appointments"."price" is null or "appointments"."price" >= 0);--> statement-breakpoint
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_positive_deposit_amount" CHECK ("appointments"."deposit_amount" is null or "appointments"."deposit_amount" > 0);--> statement-breakpoint
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_branch_id_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "appointments_branch_starts_idx" ON "appointments" USING btree ("tenant_id","branch_id","starts_at");--> statement-breakpoint
ALTER TABLE "schedule_blocks" ADD COLUMN "branch_id" uuid;--> statement-breakpoint
ALTER TABLE "schedule_blocks" ADD CONSTRAINT "schedule_blocks_branch_id_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "schedule_blocks_branch_idx" ON "schedule_blocks" USING btree ("branch_id");--> statement-breakpoint
ALTER TABLE "deposit_qrs" ADD COLUMN "branch_id" uuid;--> statement-breakpoint
ALTER TABLE "deposit_qrs" ADD CONSTRAINT "deposit_qrs_branch_id_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "deposit_qrs_branch_idx" ON "deposit_qrs" USING btree ("branch_id");--> statement-breakpoint
DROP INDEX IF EXISTS "deposit_qrs_default_uq";--> statement-breakpoint
CREATE UNIQUE INDEX "deposit_qrs_tenant_default_uq" ON "deposit_qrs" USING btree ("tenant_id") WHERE "deposit_qrs"."is_default" and "deposit_qrs"."is_active" and "deposit_qrs"."branch_id" is null;--> statement-breakpoint
CREATE UNIQUE INDEX "deposit_qrs_branch_default_uq" ON "deposit_qrs" USING btree ("tenant_id","branch_id") WHERE "deposit_qrs"."is_default" and "deposit_qrs"."is_active" and "deposit_qrs"."branch_id" is not null;--> statement-breakpoint
ALTER TABLE "conversations" ADD COLUMN "branch_id" uuid;--> statement-breakpoint
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_branch_id_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "conversations_branch_idx" ON "conversations" USING btree ("branch_id");--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "professional_id" uuid;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_professional_id_professionals_id_fk" FOREIGN KEY ("professional_id") REFERENCES "public"."professionals"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "user_professional_idx" ON "users" USING btree ("professional_id");
