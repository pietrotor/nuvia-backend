CREATE TABLE "branch_professional_service_windows" (
	"tenant_id" uuid NOT NULL,
	"branch_id" uuid NOT NULL,
	"professional_id" uuid NOT NULL,
	"service_id" uuid NOT NULL,
	"weekly_hours" jsonb NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "branch_professional_service_windows_branch_id_professional_id_service_id_pk" PRIMARY KEY("branch_id","professional_id","service_id")
);
--> statement-breakpoint
ALTER TABLE "branch_professional_service_windows" ADD CONSTRAINT "branch_professional_service_windows_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "branch_professional_service_windows" ADD CONSTRAINT "branch_professional_service_windows_branch_id_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "branch_professional_service_windows" ADD CONSTRAINT "branch_professional_service_windows_professional_id_professionals_id_fk" FOREIGN KEY ("professional_id") REFERENCES "public"."professionals"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "branch_professional_service_windows" ADD CONSTRAINT "branch_professional_service_windows_service_id_services_id_fk" FOREIGN KEY ("service_id") REFERENCES "public"."services"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "branch_professional_service_windows_tenant_idx" ON "branch_professional_service_windows" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "branch_professional_service_windows_professional_idx" ON "branch_professional_service_windows" USING btree ("professional_id");--> statement-breakpoint
CREATE INDEX "branch_professional_service_windows_service_idx" ON "branch_professional_service_windows" USING btree ("service_id");
