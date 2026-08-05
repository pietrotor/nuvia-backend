-- Idempotent demo catalog enricher for existing tenants.
-- Does NOT delete tenants, users, business_configs, or Evolution session fields.
-- Safe to re-run.
--
-- Usage:
--   PGPASSWORD=... psql -h localhost -p 5435 -U postgres -d nuvia_dev -f scripts/dev/enrich-demo-catalog.sql

BEGIN;

UPDATE business_configs bc
SET
  address = CASE bc.slug
    WHEN 'estetica-glow' THEN 'Av. Heroínas 123, Cochabamba'
    WHEN 'spa-luna' THEN 'Calle España 456, Cochabamba'
    ELSE bc.address
  END,
  business_hours = CASE bc.slug
    WHEN 'estetica-glow' THEN '{
      "mon":{"start":"09:00","end":"18:00"},"tue":{"start":"09:00","end":"18:00"},
      "wed":{"start":"09:00","end":"18:00"},"thu":{"start":"09:00","end":"18:00"},
      "fri":{"start":"09:00","end":"18:00"},"sat":{"start":"09:00","end":"13:00"},"sun":null
    }'::jsonb
    WHEN 'spa-luna' THEN '{
      "mon":{"start":"09:00","end":"17:00"},"tue":{"start":"09:00","end":"17:00"},
      "wed":{"start":"09:00","end":"17:00"},"thu":{"start":"09:00","end":"17:00"},
      "fri":{"start":"09:00","end":"17:00"},"sat":{"start":"09:00","end":"16:00"},
      "sun":{"start":"10:00","end":"14:00"}
    }'::jsonb
    ELSE bc.business_hours
  END,
  faq = CASE bc.slug
    WHEN 'estetica-glow' THEN '{
      "ubicacion":"Av. Heroínas 123, Cochabamba. Estamos a 2 cuadras de la Plaza 14 de Septiembre.",
      "pagos":"Aceptamos QR bancario, transferencia y efectivo. Las señas se pagan por QR.",
      "estacionamiento":"Hay parqueo público a media cuadra.",
      "llegada":"Te pedimos llegar 10 minutos antes. Si vas a demorar, avisanos por WhatsApp."
    }'::jsonb
    WHEN 'spa-luna' THEN '{
      "ubicacion":"Calle España 456, Cochabamba, cerca del Prado.",
      "pagos":"QR y efectivo. Señas obligatorias en tratamientos corporales.",
      "ninos":"Atendemos desde los 16 años con acompañante.",
      "cancelaciones":"Podés cancelar o reagendar hasta 24 horas antes sin cargo."
    }'::jsonb
    ELSE bc.faq
  END,
  agent_policy = COALESCE(bc.agent_policy, '{"handoffAutoResumeMinutes":60}'::jsonb),
  updated_at = now()
WHERE bc.slug IN ('estetica-glow', 'spa-luna');

UPDATE services s
SET name = 'Limpieza facial profunda', price = 150.00, duration_minutes = 60, updated_at = now()
FROM business_configs bc
WHERE s.tenant_id = bc.tenant_id
  AND bc.slug = 'estetica-glow'
  AND s.name = 'Limpieza facial';

UPDATE services s
SET name = 'Limpieza facial luminosa', price = 140.00, duration_minutes = 50, updated_at = now()
FROM business_configs bc
WHERE s.tenant_id = bc.tenant_id
  AND bc.slug = 'spa-luna'
  AND s.name IN ('Limpieza facial', 'Limpieza facial luminosa');

CREATE TEMP TABLE tmp_pro_map (
  tenant_id uuid,
  key text,
  professional_id uuid,
  PRIMARY KEY (tenant_id, key)
);

-- Glow professionals
WITH glow AS (SELECT tenant_id FROM business_configs WHERE slug = 'estetica-glow'),
wanted AS (
  SELECT * FROM (VALUES
    ('camila', 'Camila Rojas', '{
      "mon":{"start":"09:00","end":"18:00"},"tue":{"start":"09:00","end":"18:00"},
      "wed":{"start":"09:00","end":"18:00"},"thu":{"start":"09:00","end":"18:00"},
      "fri":{"start":"09:00","end":"18:00"},"sat":{"start":"09:00","end":"13:00"},"sun":null
    }'),
    ('daniela', 'Daniela Soto', '{
      "mon":{"start":"10:00","end":"19:00"},"tue":{"start":"10:00","end":"19:00"},
      "wed":{"start":"10:00","end":"19:00"},"thu":{"start":"10:00","end":"19:00"},
      "fri":{"start":"10:00","end":"19:00"},"sat":{"start":"10:00","end":"14:00"},"sun":null
    }'),
    ('valeria', 'Valeria Mamani', '{
      "mon":{"start":"13:00","end":"20:00"},"tue":{"start":"13:00","end":"20:00"},
      "wed":{"start":"13:00","end":"20:00"},"thu":{"start":"13:00","end":"20:00"},
      "fri":{"start":"13:00","end":"20:00"},"sat":{"start":"09:00","end":"15:00"},"sun":null
    }')
  ) AS v(key, name, hours)
),
ins AS (
  INSERT INTO professionals (tenant_id, name, weekly_hours, is_active)
  SELECT g.tenant_id, w.name, w.hours::jsonb, true
  FROM glow g
  CROSS JOIN wanted w
  WHERE NOT EXISTS (
    SELECT 1 FROM professionals p WHERE p.tenant_id = g.tenant_id AND p.name = w.name
  )
  RETURNING id, tenant_id, name
)
INSERT INTO tmp_pro_map (tenant_id, key, professional_id)
SELECT i.tenant_id, w.key, i.id
FROM ins i
JOIN wanted w ON w.name = i.name
ON CONFLICT DO NOTHING;

INSERT INTO tmp_pro_map (tenant_id, key, professional_id)
SELECT p.tenant_id, w.key, p.id
FROM professionals p
JOIN business_configs bc ON bc.tenant_id = p.tenant_id AND bc.slug = 'estetica-glow'
JOIN (VALUES
  ('camila', 'Camila Rojas'),
  ('daniela', 'Daniela Soto'),
  ('valeria', 'Valeria Mamani')
) AS w(key, name) ON w.name = p.name
ON CONFLICT DO NOTHING;

UPDATE professionals p
SET weekly_hours = w.hours::jsonb, is_active = true, updated_at = now()
FROM business_configs bc
JOIN (VALUES
  ('Camila Rojas', '{
    "mon":{"start":"09:00","end":"18:00"},"tue":{"start":"09:00","end":"18:00"},
    "wed":{"start":"09:00","end":"18:00"},"thu":{"start":"09:00","end":"18:00"},
    "fri":{"start":"09:00","end":"18:00"},"sat":{"start":"09:00","end":"13:00"},"sun":null
  }'),
  ('Daniela Soto', '{
    "mon":{"start":"10:00","end":"19:00"},"tue":{"start":"10:00","end":"19:00"},
    "wed":{"start":"10:00","end":"19:00"},"thu":{"start":"10:00","end":"19:00"},
    "fri":{"start":"10:00","end":"19:00"},"sat":{"start":"10:00","end":"14:00"},"sun":null
  }'),
  ('Valeria Mamani', '{
    "mon":{"start":"13:00","end":"20:00"},"tue":{"start":"13:00","end":"20:00"},
    "wed":{"start":"13:00","end":"20:00"},"thu":{"start":"13:00","end":"20:00"},
    "fri":{"start":"13:00","end":"20:00"},"sat":{"start":"09:00","end":"15:00"},"sun":null
  }')
) AS w(name, hours) ON true
WHERE p.tenant_id = bc.tenant_id
  AND bc.slug = 'estetica-glow'
  AND p.name = w.name;

-- Luna professionals
WITH luna AS (SELECT tenant_id FROM business_configs WHERE slug = 'spa-luna'),
wanted AS (
  SELECT * FROM (VALUES
    ('sofia', 'Sofía Arce', '{
      "mon":{"start":"09:00","end":"17:00"},"tue":{"start":"09:00","end":"17:00"},
      "wed":{"start":"09:00","end":"17:00"},"thu":{"start":"09:00","end":"17:00"},
      "fri":{"start":"09:00","end":"17:00"},"sat":{"start":"09:00","end":"16:00"},
      "sun":{"start":"10:00","end":"14:00"}
    }'),
    ('andrea', 'Andrea Flores', '{
      "mon":{"start":"10:00","end":"19:00"},"tue":{"start":"10:00","end":"19:00"},
      "wed":{"start":"10:00","end":"19:00"},"thu":{"start":"10:00","end":"19:00"},
      "fri":{"start":"10:00","end":"19:00"},"sat":{"start":"10:00","end":"14:00"},"sun":null
    }'),
    ('lucia', 'Lucía Quispe', '{
      "mon":{"start":"13:00","end":"20:00"},"tue":{"start":"13:00","end":"20:00"},
      "wed":{"start":"13:00","end":"20:00"},"thu":{"start":"13:00","end":"20:00"},
      "fri":{"start":"13:00","end":"20:00"},"sat":{"start":"09:00","end":"15:00"},"sun":null
    }')
  ) AS v(key, name, hours)
),
ins AS (
  INSERT INTO professionals (tenant_id, name, weekly_hours, is_active)
  SELECT l.tenant_id, w.name, w.hours::jsonb, true
  FROM luna l
  CROSS JOIN wanted w
  WHERE NOT EXISTS (
    SELECT 1 FROM professionals p WHERE p.tenant_id = l.tenant_id AND p.name = w.name
  )
  RETURNING id, tenant_id, name
)
INSERT INTO tmp_pro_map (tenant_id, key, professional_id)
SELECT i.tenant_id, w.key, i.id
FROM ins i
JOIN wanted w ON w.name = i.name
ON CONFLICT DO NOTHING;

INSERT INTO tmp_pro_map (tenant_id, key, professional_id)
SELECT p.tenant_id, w.key, p.id
FROM professionals p
JOIN business_configs bc ON bc.tenant_id = p.tenant_id AND bc.slug = 'spa-luna'
JOIN (VALUES
  ('sofia', 'Sofía Arce'),
  ('andrea', 'Andrea Flores'),
  ('lucia', 'Lucía Quispe')
) AS w(key, name) ON w.name = p.name
ON CONFLICT DO NOTHING;

UPDATE professionals p
SET is_active = false, updated_at = now()
FROM business_configs bc
WHERE p.tenant_id = bc.tenant_id
  AND bc.slug = 'spa-luna'
  AND p.name = 'Camila Rojas';

-- Glow services
WITH glow AS (SELECT tenant_id FROM business_configs WHERE slug = 'estetica-glow')
INSERT INTO services (tenant_id, name, duration_minutes, price, currency, requires_deposit, deposit_amount, deposit_percent, is_active)
SELECT g.tenant_id, v.name, v.duration, v.price, 'BOB'::currency, v.req_dep, v.dep_amt, v.dep_pct, true
FROM glow g
CROSS JOIN (VALUES
  ('Hidrafacial', 75, 280.00, true, 50.00, NULL::int),
  ('Peeling químico', 45, 220.00, true, NULL::numeric, 30),
  ('Manicure spa', 45, 80.00, false, NULL::numeric, NULL::int),
  ('Pedicure spa', 60, 100.00, false, NULL::numeric, NULL::int),
  ('Maquillaje social', 60, 180.00, true, 40.00, NULL::int),
  ('Depilación láser axilas', 30, 120.00, false, NULL::numeric, NULL::int),
  ('Masaje relajante 60 min', 60, 160.00, false, NULL::numeric, NULL::int)
) AS v(name, duration, price, req_dep, dep_amt, dep_pct)
WHERE NOT EXISTS (
  SELECT 1 FROM services s WHERE s.tenant_id = g.tenant_id AND s.name = v.name
);

INSERT INTO professional_services (tenant_id, professional_id, service_id)
SELECT s.tenant_id, m.professional_id, s.id
FROM services s
JOIN business_configs bc ON bc.tenant_id = s.tenant_id AND bc.slug = 'estetica-glow'
JOIN tmp_pro_map m ON m.tenant_id = s.tenant_id
JOIN (VALUES
  ('Limpieza facial profunda', 'camila'),
  ('Limpieza facial profunda', 'valeria'),
  ('Hidrafacial', 'camila'),
  ('Peeling químico', 'camila'),
  ('Manicure spa', 'daniela'),
  ('Pedicure spa', 'daniela'),
  ('Maquillaje social', 'daniela'),
  ('Maquillaje social', 'valeria'),
  ('Depilación láser axilas', 'valeria'),
  ('Masaje relajante 60 min', 'valeria')
) AS link(service_name, pro_key)
  ON link.service_name = s.name AND link.pro_key = m.key
ON CONFLICT DO NOTHING;

-- Luna services
WITH luna AS (SELECT tenant_id FROM business_configs WHERE slug = 'spa-luna')
INSERT INTO services (tenant_id, name, duration_minutes, price, currency, requires_deposit, deposit_amount, deposit_percent, is_active)
SELECT l.tenant_id, v.name, v.duration, v.price, 'BOB'::currency, v.req_dep, v.dep_amt, v.dep_pct, true
FROM luna l
CROSS JOIN (VALUES
  ('Masaje descontracturante', 60, 170.00, false, NULL::numeric, NULL::int),
  ('Masaje con piedras calientes', 90, 250.00, true, 60.00, NULL::int),
  ('Envolturas corporales', 75, 210.00, true, NULL::numeric, 25),
  ('Drenaje linfático', 60, 190.00, false, NULL::numeric, NULL::int),
  ('Ritual spa pareja', 120, 450.00, true, 100.00, NULL::int)
) AS v(name, duration, price, req_dep, dep_amt, dep_pct)
WHERE NOT EXISTS (
  SELECT 1 FROM services s WHERE s.tenant_id = l.tenant_id AND s.name = v.name
);

INSERT INTO professional_services (tenant_id, professional_id, service_id)
SELECT s.tenant_id, m.professional_id, s.id
FROM services s
JOIN business_configs bc ON bc.tenant_id = s.tenant_id AND bc.slug = 'spa-luna'
JOIN tmp_pro_map m ON m.tenant_id = s.tenant_id
JOIN (VALUES
  ('Limpieza facial luminosa', 'andrea'),
  ('Limpieza facial luminosa', 'lucia'),
  ('Masaje descontracturante', 'sofia'),
  ('Masaje descontracturante', 'lucia'),
  ('Masaje con piedras calientes', 'sofia'),
  ('Envolturas corporales', 'andrea'),
  ('Drenaje linfático', 'lucia'),
  ('Ritual spa pareja', 'sofia'),
  ('Ritual spa pareja', 'andrea')
) AS link(service_name, pro_key)
  ON link.service_name = s.name AND link.pro_key = m.key
ON CONFLICT DO NOTHING;

INSERT INTO clients (tenant_id, name, phone_e164)
SELECT bc.tenant_id, v.name, v.phone
FROM business_configs bc
JOIN (VALUES
  ('estetica-glow', 'María Fernanda', '+59170000011'),
  ('estetica-glow', 'Paola Choque', '+59170000012'),
  ('spa-luna', 'Carla Méndez', '+59170000021')
) AS v(slug, name, phone) ON v.slug = bc.slug
WHERE NOT EXISTS (
  SELECT 1 FROM clients c WHERE c.tenant_id = bc.tenant_id AND c.phone_e164 = v.phone
);

-- Resume every paused WhatsApp conversation so Vale answers again.
UPDATE conversations
SET
  bot_paused = false,
  bot_paused_at = NULL,
  handoff_reason = NULL,
  updated_at = now()
WHERE bot_paused = true;

COMMIT;

SELECT bc.slug,
  (SELECT count(*) FROM professionals p WHERE p.tenant_id = bc.tenant_id AND p.is_active) AS pros_active,
  (SELECT count(*) FROM services s WHERE s.tenant_id = bc.tenant_id AND s.is_active) AS services,
  (SELECT count(*) FROM conversations c WHERE c.tenant_id = bc.tenant_id AND c.bot_paused) AS paused_chats
FROM business_configs bc
WHERE bc.slug IN ('estetica-glow', 'spa-luna')
ORDER BY bc.slug;
