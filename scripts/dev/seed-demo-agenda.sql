-- Fills the current week of "Estética Glow" with a believable agenda so the panel can be
-- looked at with real density instead of two lonely cards.
--
-- Safe to re-run: every row is skipped when that professional already has something at
-- that exact hour, and nothing is ever deleted.
--
--   docker exec -i nuvia_db psql -U postgres -d nuvia_dev < scripts/dev/seed-demo-agenda.sql
--
-- Hours are written as the business reads them (America/La_Paz) and stored as UTC.

WITH tenant AS (
  SELECT id FROM tenants WHERE name = 'Estética Glow'
),
week AS (
  SELECT date_trunc('week', now() AT TIME ZONE 'America/La_Paz')::date AS monday
),
plan (day_offset, at_time, professional_name, service_name, client_name, status) AS (
  VALUES
    -- Monday: already happened
    (0, '09:00', 'Camila Rojas',   'Limpieza facial profunda', 'María Fernanda', 'attended'),
    (0, '11:00', 'Camila Rojas',   'Peeling químico',          'Paola Choque',   'attended'),
    (0, '14:00', 'Camila Rojas',   'Manicure spa',             'Cliente Demo',   'no_show'),
    (0, '16:00', 'Camila Rojas',   'Hidrafacial',              'Pietro Torrico', 'attended'),
    (0, '10:00', 'Daniela Soto',   'Masaje relajante 60 min',  'Paola Choque',   'attended'),
    (0, '12:00', 'Daniela Soto',   'Pedicure spa',             'María Fernanda', 'attended'),
    (0, '15:00', 'Daniela Soto',   'Maquillaje social',        'Cliente Demo',   'attended'),
    (0, '13:00', 'Valeria Mamani', 'Manicure spa',             'Pietro Torrico', 'attended'),
    (0, '15:00', 'Valeria Mamani', 'Peeling químico',          'María Fernanda', 'attended'),
    (0, '17:00', 'Valeria Mamani', 'Limpieza facial profunda', 'Paola Choque',   'attended'),

    -- Tuesday
    (1, '09:30', 'Camila Rojas',   'Depilación láser axilas',  'Cliente Demo',   'attended'),
    (1, '10:30', 'Camila Rojas',   'Limpieza facial profunda', 'Pietro Torrico', 'attended'),
    (1, '15:00', 'Camila Rojas',   'Pedicure spa',             'María Fernanda', 'attended'),
    (1, '11:00', 'Daniela Soto',   'Masaje relajante 60 min',  'Cliente Demo',   'attended'),
    (1, '14:00', 'Daniela Soto',   'Manicure spa',             'Paola Choque',   'cancelled'),
    (1, '16:00', 'Daniela Soto',   'Pedicure spa',             'Pietro Torrico', 'attended'),
    (1, '13:30', 'Valeria Mamani', 'Pedicure spa',             'María Fernanda', 'attended'),
    (1, '16:00', 'Valeria Mamani', 'Depilación láser axilas',  'Cliente Demo',   'no_show'),
    (1, '18:00', 'Valeria Mamani', 'Masaje relajante 60 min',  'Paola Choque',   'attended'),

    -- Wednesday: the day the panel opens on
    (2, '09:00', 'Camila Rojas',   'Limpieza facial profunda', 'Paola Choque',   'attended'),
    (2, '10:30', 'Camila Rojas',   'Peeling químico',          'María Fernanda', 'attended'),
    (2, '12:00', 'Camila Rojas',   'Hidrafacial',              'Pietro Torrico', 'confirmed'),
    (2, '14:15', 'Camila Rojas',   'Manicure spa',             'Cliente Demo',   'confirmed'),
    (2, '15:30', 'Camila Rojas',   'Depilación láser axilas',  'Paola Choque',   'confirmed'),
    (2, '16:30', 'Camila Rojas',   'Limpieza facial profunda', 'María Fernanda', 'pending_deposit'),
    (2, '10:00', 'Daniela Soto',   'Masaje relajante 60 min',  'Cliente Demo',   'attended'),
    (2, '11:30', 'Daniela Soto',   'Pedicure spa',             'Paola Choque',   'confirmed'),
    (2, '13:00', 'Daniela Soto',   'Maquillaje social',        'María Fernanda', 'confirmed'),
    (2, '15:00', 'Daniela Soto',   'Masaje relajante 60 min',  'Pietro Torrico', 'confirmed'),
    (2, '17:00', 'Daniela Soto',   'Manicure spa',             'Cliente Demo',   'pending_deposit'),
    (2, '13:00', 'Valeria Mamani', 'Manicure spa',             'Paola Choque',   'confirmed'),
    (2, '14:30', 'Valeria Mamani', 'Depilación láser axilas',  'María Fernanda', 'confirmed'),
    (2, '15:30', 'Valeria Mamani', 'Peeling químico',          'Cliente Demo',   'confirmed'),
    (2, '17:00', 'Valeria Mamani', 'Hidrafacial',              'Pietro Torrico', 'confirmed'),
    (2, '19:00', 'Valeria Mamani', 'Depilación láser axilas',  'Paola Choque',   'pending_deposit'),

    -- Thursday
    (3, '09:00', 'Camila Rojas',   'Hidrafacial',              'María Fernanda', 'confirmed'),
    (3, '11:00', 'Camila Rojas',   'Limpieza facial profunda', 'Cliente Demo',   'confirmed'),
    (3, '14:00', 'Camila Rojas',   'Peeling químico',          'Pietro Torrico', 'confirmed'),
    (3, '10:00', 'Daniela Soto',   'Pedicure spa',             'Paola Choque',   'confirmed'),
    (3, '12:00', 'Daniela Soto',   'Masaje relajante 60 min',  'María Fernanda', 'confirmed'),
    (3, '16:00', 'Daniela Soto',   'Maquillaje social',        'Cliente Demo',   'confirmed'),
    (3, '13:00', 'Valeria Mamani', 'Limpieza facial profunda', 'Pietro Torrico', 'confirmed'),
    (3, '15:00', 'Valeria Mamani', 'Manicure spa',             'Paola Choque',   'confirmed'),
    (3, '18:00', 'Valeria Mamani', 'Peeling químico',          'María Fernanda', 'confirmed'),

    -- Friday
    (4, '10:00', 'Camila Rojas',   'Manicure spa',             'Cliente Demo',   'confirmed'),
    (4, '12:00', 'Camila Rojas',   'Limpieza facial profunda', 'Paola Choque',   'pending_deposit'),
    (4, '15:00', 'Camila Rojas',   'Hidrafacial',              'María Fernanda', 'confirmed'),
    (4, '10:30', 'Daniela Soto',   'Masaje relajante 60 min',  'Pietro Torrico', 'confirmed'),
    (4, '13:00', 'Daniela Soto',   'Pedicure spa',             'Cliente Demo',   'confirmed'),
    (4, '17:00', 'Daniela Soto',   'Maquillaje social',        'Paola Choque',   'pending_deposit'),
    (4, '14:00', 'Valeria Mamani', 'Hidrafacial',              'María Fernanda', 'confirmed'),
    (4, '16:00', 'Valeria Mamani', 'Limpieza facial profunda', 'Cliente Demo',   'confirmed'),
    (4, '18:30', 'Valeria Mamani', 'Manicure spa',             'Pietro Torrico', 'confirmed'),

    -- Saturday: shorter shifts
    (5, '09:00', 'Camila Rojas',   'Depilación láser axilas',  'Paola Choque',   'confirmed'),
    (5, '10:00', 'Camila Rojas',   'Limpieza facial profunda', 'María Fernanda', 'confirmed'),
    (5, '10:30', 'Daniela Soto',   'Manicure spa',             'Cliente Demo',   'confirmed'),
    (5, '12:00', 'Daniela Soto',   'Masaje relajante 60 min',  'Pietro Torrico', 'confirmed'),
    (5, '09:30', 'Valeria Mamani', 'Peeling químico',          'María Fernanda', 'confirmed'),
    (5, '11:00', 'Valeria Mamani', 'Limpieza facial profunda', 'Paola Choque',   'confirmed'),
    (5, '13:00', 'Valeria Mamani', 'Manicure spa',             'Cliente Demo',   'confirmed')
),
slots AS (
  SELECT
    t.id AS tenant_id,
    c.id AS client_id,
    p.id AS professional_id,
    s.id AS service_id,
    s.duration_minutes,
    plan.status,
    (((w.monday + plan.day_offset) + plan.at_time::time) AT TIME ZONE 'America/La_Paz') AS starts_at
  FROM plan
  CROSS JOIN tenant t
  CROSS JOIN week w
  JOIN professionals p
    ON p.tenant_id = t.id AND p.name = plan.professional_name
  JOIN services s
    ON s.tenant_id = t.id AND s.name = plan.service_name
  JOIN clients c
    ON c.tenant_id = t.id AND c.name = plan.client_name
)
INSERT INTO appointments (
  tenant_id, client_id, professional_id, service_id, starts_at, ends_at, status
)
SELECT
  slots.tenant_id,
  slots.client_id,
  slots.professional_id,
  slots.service_id,
  slots.starts_at,
  slots.starts_at + (slots.duration_minutes || ' minutes')::interval,
  slots.status::appointment_status
FROM slots
WHERE NOT EXISTS (
  SELECT 1
  FROM appointments existing
  WHERE existing.tenant_id = slots.tenant_id
    AND existing.professional_id = slots.professional_id
    AND existing.starts_at = slots.starts_at
);
