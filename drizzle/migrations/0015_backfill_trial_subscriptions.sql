INSERT INTO "plans" ("code", "name", "is_active", "price_amount", "price_currency", "billing_period_months", "config")
SELECT
  'trial',
  'Prueba',
  true,
  '0.00',
  'BOB',
  1,
  '{"quotas":{"aiRepliesPerPeriod":200},"caps":{"professionals":3,"services":20,"branches":1,"panelUsers":3},"features":{"multiBranch":false,"webBookingPage":false,"sessionPackages":false,"reminders":false,"reports":false}}'::jsonb
WHERE NOT EXISTS (SELECT 1 FROM "plans" WHERE "code" = 'trial');
--> statement-breakpoint
INSERT INTO "subscriptions" (
  "tenant_id",
  "plan_id",
  "status",
  "current_period_start",
  "current_period_end",
  "price_amount",
  "price_currency",
  "notes"
)
SELECT
  t.id,
  p.id,
  'trialing',
  now(),
  now() + interval '14 days',
  p.price_amount,
  p.price_currency,
  'Backfilled trial subscription'
FROM "tenants" t
CROSS JOIN "plans" p
WHERE p.code = 'trial'
  AND NOT EXISTS (
    SELECT 1
    FROM "subscriptions" s
    WHERE s.tenant_id = t.id
      AND s.status <> 'cancelled'
  );
