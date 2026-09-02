// Additive clinic demo for a live database. Unlike SeedUseCase it never wipes
// tenants: it creates Clínica Médica Los Pinos when missing, assigns plan `pro`,
// and fills the catalog only if that tenant has no professionals yet.
//
//   docker compose -f docker-compose.prod.yaml exec api node scripts/seed-clinic-los-pinos.mjs
//
// Or from the droplet, with the git tree mounted:
//   docker compose -f docker-compose.prod.yaml run --rm --no-deps \
//     -v /opt/nuvia-backend/scripts:/app/scripts \
//     api node /app/scripts/seed-clinic-los-pinos.mjs
//
// CLINIC_OWNER_PASSWORD overrides the generated owner password. FORCE=1 reseeds
// the catalog even when professionals already exist.
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { randomBytes, randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';

import bcrypt from 'bcrypt';
import pg from 'pg';

const { Client } = pg;
const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const LA_PAZ_OFFSET_HOURS = 4;
const SLUG = 'clinica-los-pinos';
const OWNER_EMAIL = 'sofia@lospinos.test';
const STAFF_EMAIL = 'recepcion@lospinos.test';

const HOURS = {
  full: {
    mon: { start: '09:00', end: '18:00' },
    tue: { start: '09:00', end: '18:00' },
    wed: { start: '09:00', end: '18:00' },
    thu: { start: '09:00', end: '18:00' },
    fri: { start: '09:00', end: '18:00' },
    sat: { start: '09:00', end: '13:00' },
    sun: null,
  },
  late: {
    mon: { start: '10:00', end: '19:00' },
    tue: { start: '10:00', end: '19:00' },
    wed: { start: '10:00', end: '19:00' },
    thu: { start: '10:00', end: '19:00' },
    fri: { start: '10:00', end: '19:00' },
    sat: { start: '10:00', end: '14:00' },
    sun: null,
  },
  afternoon: {
    mon: { start: '13:00', end: '20:00' },
    tue: { start: '13:00', end: '20:00' },
    wed: { start: '13:00', end: '20:00' },
    thu: { start: '13:00', end: '20:00' },
    fri: { start: '13:00', end: '20:00' },
    sat: { start: '09:00', end: '15:00' },
    sun: null,
  },
  morning: {
    mon: { start: '08:00', end: '13:00' },
    tue: { start: '08:00', end: '13:00' },
    wed: { start: '08:00', end: '13:00' },
    thu: { start: '08:00', end: '13:00' },
    fri: { start: '08:00', end: '13:00' },
    sat: null,
    sun: null,
  },
};

const PROFESSIONALS = [
  { key: 'andrea', name: 'Dra. Andrea Molina', hours: HOURS.full },
  { key: 'mateo', name: 'Dr. Mateo Ríos', hours: HOURS.morning },
  { key: 'sebastian', name: 'Dr. Sebastián Torrico', hours: HOURS.full },
  { key: 'natalia', name: 'Dra. Natalia Villarroel', hours: HOURS.late },
  { key: 'mauricio', name: 'Dr. Mauricio Salvatierra', hours: HOURS.full },
  { key: 'alejandra', name: 'Dra. Alejandra Valverde', hours: HOURS.afternoon },
  { key: 'fernando', name: 'Dr. Fernando Aramayo', hours: HOURS.afternoon },
];

const SERVICES = [
  {
    key: 'medicina-interna',
    name: 'Consulta de medicina interna',
    description:
      'Consulta general de adultos: control, chequeo y derivación a especialidad si hace falta.',
    keywords: [
      'medicina interna',
      'clinica general',
      'chequeo',
      'medico general',
    ],
    duration: 30,
    price: '150.00',
    pros: ['andrea'],
  },
  {
    key: 'adulto-mayor',
    name: 'Consulta de adulto mayor',
    description:
      'Evaluación geriátrica de control. El plan de seguimiento lo define la médica en consultorio.',
    keywords: ['geriatria', 'adulto mayor', 'abuelos', 'tercera edad'],
    duration: 40,
    price: '150.00',
    pros: ['andrea'],
  },
  {
    key: 'pediatria',
    name: 'Consulta pediátrica',
    description:
      'Consulta de niños y adolescentes. Se paga el total por adelantado; el turno se confirma al verificar el QR.',
    keywords: ['pediatria', 'niños', 'pediatrico', 'control del bebe'],
    duration: 30,
    price: '150.00',
    depositAmount: '150.00',
    pros: ['mateo'],
  },
  {
    key: 'control-pediatrico',
    name: 'Control pediátrico',
    description:
      'Control de seguimiento. No incluye interpretación de laboratorios por WhatsApp.',
    keywords: ['control pediatrico', 'control del niño', 'peso y talla'],
    duration: 25,
    price: '120.00',
    pros: ['mateo'],
  },
  {
    key: 'urologia',
    name: 'Consulta urológica',
    description:
      'Consulta de urología. Cualquier indicación o estudio lo define el médico en consultorio.',
    keywords: ['urologia', 'urologo', 'prostata', 'infertilidad'],
    duration: 30,
    price: '150.00',
    pros: ['sebastian'],
  },
  {
    key: 'una-encarnada',
    name: 'Extracción de uña encarnada',
    description:
      'Evaluación y procedimiento de uña encarnada. El médico confirma en consultorio si corresponde hacerlo ese día.',
    keywords: ['uña encarnada', 'uñero', 'podologia', 'uña'],
    duration: 40,
    price: '200.00',
    pros: ['sebastian'],
  },
  {
    key: 'traumatologia',
    name: 'Consulta traumatológica',
    description:
      'Consulta de traumatología para dolor articular o lesiones. No incluye rayos; si hacen falta se coordinan aparte.',
    keywords: ['traumatologia', 'hueso', 'rodilla', 'esguince', 'dolor'],
    duration: 30,
    price: '150.00',
    pros: ['mauricio'],
  },
  {
    key: 'ginecologia',
    name: 'Consulta ginecológica',
    description:
      'Consulta de ginecología y control. Los estudios se interpretan en consultorio.',
    keywords: ['ginecologia', 'ginecologa', 'papanicolau', 'pap'],
    duration: 30,
    price: '150.00',
    pros: ['natalia'],
  },
  {
    key: 'tamizaje-cuello',
    name: 'Tamizaje preventivo de cuello uterino',
    description:
      'Agenda de consulta preventiva. El PAP y laboratorio se coordinan en recepción; no se entregan resultados por WhatsApp.',
    keywords: [
      'pap',
      'papanicolau',
      'cuello uterino',
      'prevencion',
      'cancer de cuello',
    ],
    duration: 40,
    price: '150.00',
    pros: ['natalia'],
  },
  {
    key: 'endocrinologia',
    name: 'Consulta endocrinológica',
    description:
      'Consulta de endocrinología. El médico indica en consultorio si hace falta laboratorio.',
    keywords: ['endocrinologia', 'tiroides', 'diabetes', 'hormonas'],
    duration: 30,
    price: '150.00',
    pros: ['alejandra'],
  },
  {
    key: 'evaluacion-diabetes',
    name: 'Evaluación de diabetes',
    description:
      'Consulta para control de glucosa. Los laboratorios se piden o se leen en consultorio, no por chat.',
    keywords: ['diabetes', 'glucosa', 'azucar', 'hemoglobina'],
    duration: 35,
    price: '240.00',
    pros: ['alejandra'],
  },
  {
    key: 'evaluacion-tiroides',
    name: 'Evaluación tiroidea',
    description:
      'Consulta de control tiroideo. TSH y demás estudios se interpretan con la médica.',
    keywords: ['tiroides', 'tsh', 't4', 'bocio'],
    duration: 35,
    price: '420.00',
    pros: ['alejandra'],
  },
  {
    key: 'evaluacion-bariatrica',
    name: 'Evaluación para cirugía bariátrica',
    description:
      'Consulta de evaluación. No agenda la cirugía: el cirujano define el siguiente paso en consultorio.',
    keywords: [
      'bariatrica',
      'manga gastrica',
      'obesidad',
      'cirugia de obesidad',
    ],
    duration: 45,
    price: '200.00',
    pros: ['fernando'],
  },
];

const CLIENTS = [
  { name: 'Elena Quiroga', phone: '+59170003101' },
  {
    name: 'Tomás Rivera',
    phone: '+59170003102',
    notes: 'Viola, 4 años. Viene con la mamá.',
  },
  { name: 'Marcos Peña', phone: '+59170003103' },
  { name: 'Luciana Calderón', phone: '+59170003104' },
  { name: 'Roberto Aguirre', phone: '+59170003105' },
  { name: 'Patricia Núñez', phone: '+59170003106' },
  { name: 'Jorge Salazar', phone: '+59170003107' },
  { name: 'Camila Ferrel', phone: '+59170003108' },
];

const APPOINTMENTS = [
  {
    client: 1,
    pro: 'mateo',
    service: 'pediatria',
    future: 1,
    hour: 9,
    status: 'pending_deposit',
  },
  {
    client: 7,
    pro: 'mateo',
    service: 'pediatria',
    future: 2,
    hour: 10,
    status: 'confirmed',
  },
  {
    client: 0,
    pro: 'andrea',
    service: 'medicina-interna',
    future: 0,
    hour: 11,
    status: 'confirmed',
  },
  {
    client: 2,
    pro: 'sebastian',
    service: 'urologia',
    future: 0,
    hour: 15,
    status: 'confirmed',
  },
  {
    client: 3,
    pro: 'natalia',
    service: 'ginecologia',
    future: 1,
    hour: 11,
    status: 'confirmed',
  },
  {
    client: 4,
    pro: 'mauricio',
    service: 'traumatologia',
    future: 3,
    hour: 10,
    status: 'confirmed',
  },
  {
    client: 5,
    pro: 'alejandra',
    service: 'evaluacion-tiroides',
    future: 4,
    hour: 14,
    status: 'confirmed',
  },
  {
    client: 6,
    pro: 'fernando',
    service: 'evaluacion-bariatrica',
    past: 2,
    hour: 16,
    status: 'attended',
  },
  {
    client: 0,
    pro: 'andrea',
    service: 'adulto-mayor',
    past: 5,
    hour: 10,
    status: 'attended',
  },
  {
    client: 2,
    pro: 'sebastian',
    service: 'una-encarnada',
    past: 1,
    hour: 11,
    status: 'no_show',
  },
];

const FAQ = {
  ubicacion:
    'Estamos en Av. América 1240, entre Beijing y Melchor Pérez, Cochabamba.',
  pagos:
    'Aceptamos QR bancario, transferencia y efectivo. La consulta pediátrica se paga por adelantado por QR; el turno se confirma cuando verificamos el comprobante.',
  llegada:
    'Llegá 10 minutos antes. Si es la primera vez, traé carnet y estudios previos si los tenés.',
  cancelaciones:
    'Podés cancelar o reagendar hasta 24 horas antes. Si la consulta ya estaba pagada, coordinamos el cambio con recepción.',
  seguros:
    'Trabajamos de forma particular. Si tu seguro reembolsa, te damos el recibo de la consulta.',
  estudios:
    'Los laboratorios y las imágenes se interpretan en consultorio. El asistente no lee resultados por WhatsApp.',
};

const PRO_PLAN = {
  code: 'pro',
  name: 'Pro',
  price: '650.00',
  config: {
    quotas: { aiRepliesPerPeriod: 2000 },
    caps: { professionals: 12, services: 80, branches: 5, panelUsers: 15 },
    features: {
      multiBranch: true,
      webBookingPage: true,
      sessionPackages: true,
      reminders: true,
      reports: true,
    },
  },
};

const LOCAL_TODAY = (() => {
  const now = new Date(Date.now() - LA_PAZ_OFFSET_HOURS * 3_600_000);
  return new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
  );
})();

function isBusinessDay(date) {
  const day = date.getUTCDay();
  return day >= 1 && day <= 5;
}

function businessDay({ past, future }) {
  const date = new Date(LOCAL_TODAY);
  if (past !== undefined) {
    let seen = 0;
    while (seen < past) {
      date.setUTCDate(date.getUTCDate() - 1);
      if (isBusinessDay(date)) seen += 1;
    }
    return date;
  }
  let seen = -1;
  for (;;) {
    if (isBusinessDay(date)) {
      seen += 1;
      if (seen === future) return date;
    }
    date.setUTCDate(date.getUTCDate() + 1);
  }
}

function localDate(slot, hour, minute = 0) {
  const date = businessDay(slot);
  return new Date(
    Date.UTC(
      date.getUTCFullYear(),
      date.getUTCMonth(),
      date.getUTCDate(),
      hour + LA_PAZ_OFFSET_HOURS,
      minute,
    ),
  );
}

function depositFor(service) {
  return service.depositAmount ?? null;
}

async function ensureMedicalCategory(db) {
  await db.query(
    `alter type business_category add value if not exists 'medical'`,
  );
  return 'business_category: medical is available';
}

async function ensureProPlan(db) {
  const existing = await db.query('select id from plans where code = $1', [
    PRO_PLAN.code,
  ]);
  if (existing.rows[0]) return existing.rows[0].id;

  const created = await db.query(
    `insert into plans (code, name, is_active, price_amount, price_currency, billing_period_months, config)
     values ($1,$2,true,$3,'BOB',1,$4::jsonb) returning id`,
    [
      PRO_PLAN.code,
      PRO_PLAN.name,
      PRO_PLAN.price,
      JSON.stringify(PRO_PLAN.config),
    ],
  );
  return created.rows[0].id;
}

async function ensureTenant(db, { passwordHash }) {
  const bySlug = await db.query(
    'select tenant_id from business_configs where slug = $1',
    [SLUG],
  );
  if (bySlug.rows[0]) {
    return {
      tenantId: bySlug.rows[0].tenant_id,
      created: false,
      password: null,
    };
  }

  const tenant = await db.query(
    `insert into tenants (name, timezone, status)
     values ('Clínica Médica Los Pinos', 'America/La_Paz', 'active')
     returning id`,
  );
  const tenantId = tenant.rows[0].id;

  await db.query(
    `insert into business_configs (
       tenant_id, slug, agent_name, tone, business_category, currency, country_code,
       booking_policy, agent_policy, client_reminder_policy, faq
     ) values (
       $1,$2,'Vale','warm','medical','BOB','BO',
       $3::jsonb,$4::jsonb,$5::jsonb,$6::jsonb
     )`,
    [
      tenantId,
      SLUG,
      JSON.stringify({
        minLeadTimeHours: 2,
        cancelRescheduleHours: 24,
        noShowMessage:
          'Si no podés asistir, avisanos con anticipación para liberar el horario.',
      }),
      JSON.stringify({
        handoffAutoResumeMinutes: 60,
        emojiPolicy: 'light',
        businessNotes: null,
        humanAttentionLabelSync: false,
        humanAttentionLabelName: 'Requiere atención humana',
      }),
      JSON.stringify({
        enabled: true,
        offsets: ['24h', '2h'],
        thankYouAfterVisit: false,
      }),
      JSON.stringify(FAQ),
    ],
  );

  await db.query(
    `insert into branches (
       tenant_id, name, slug, address, phone, weekly_hours, is_primary, is_active
     ) values ($1,'Casa Matriz','casa-matriz',$2,$3,$4::jsonb,true,true)`,
    [
      tenantId,
      'Av. América 1240, Cochabamba',
      '+59170003000',
      JSON.stringify(HOURS.full),
    ],
  );

  await db.query(
    `insert into users (tenant_id, name, email, phone, password, role, is_active)
     values ($1,'Sofía Mendoza',$2,'+59170003001',$3,'owner',true)`,
    [tenantId, OWNER_EMAIL, passwordHash],
  );
  await db.query(
    `insert into users (tenant_id, name, email, phone, password, role, is_active)
     values ($1,'Carla Terán',$2,'+59170003002',$3,'staff',true)`,
    [tenantId, STAFF_EMAIL, passwordHash],
  );

  return { tenantId, created: true };
}

async function assignProPlan(db, { tenantId, planId }) {
  const current = await db.query(
    `select id from subscriptions
     where tenant_id = $1 and status <> 'cancelled'
     order by created_at desc limit 1`,
    [tenantId],
  );
  const now = new Date();
  const periodEnd = new Date(now);
  periodEnd.setUTCMonth(periodEnd.getUTCMonth() + 1);

  if (current.rows[0]) {
    await db.query(
      `update subscriptions
         set plan_id = $2, status = 'active',
             current_period_start = $3, current_period_end = $4,
             price_amount = $5, price_currency = 'BOB',
             notes = 'Clinic demo on pro', cancelled_at = null
       where id = $1`,
      [
        current.rows[0].id,
        planId,
        now.toISOString(),
        periodEnd.toISOString(),
        PRO_PLAN.price,
      ],
    );
    return 'subscription: moved to pro';
  }

  await db.query(
    `insert into subscriptions (
       tenant_id, plan_id, status, current_period_start, current_period_end,
       price_amount, price_currency, notes
     ) values ($1,$2,'active',$3,$4,$5,'BOB','Clinic demo on pro')`,
    [
      tenantId,
      planId,
      now.toISOString(),
      periodEnd.toISOString(),
      PRO_PLAN.price,
    ],
  );
  return 'subscription: created on pro';
}

async function seedCatalog(db, { tenantId, branch, owner }) {
  const existing = await db.query(
    'select count(*)::int as n from professionals where tenant_id = $1',
    [tenantId],
  );
  if (existing.rows[0].n > 0 && process.env.FORCE !== '1') {
    return `catalog: skipped, tenant already has ${existing.rows[0].n} professional(s)`;
  }

  const proIds = {};
  for (const pro of PROFESSIONALS) {
    const row = await db.query(
      `insert into professionals (tenant_id, name, is_active)
         values ($1,$2,true) returning id`,
      [tenantId, pro.name],
    );
    proIds[pro.key] = row.rows[0].id;
    await db.query(
      `insert into branch_professionals (tenant_id, branch_id, professional_id, weekly_hours, is_active)
         values ($1,$2,$3,$4::jsonb,true)`,
      [tenantId, branch.id, row.rows[0].id, JSON.stringify(pro.hours)],
    );
  }

  const serviceIds = {};
  for (const service of SERVICES) {
    const row = await db.query(
      `insert into services (
           tenant_id, name, description, keywords, duration_minutes, currency, price,
           requires_deposit, deposit_amount, deposit_percent, client_chooses_professional, is_active
         ) values ($1,$2,$3,$4::text[],$5,'BOB',$6,$7,$8,null,true,true) returning id`,
      [
        tenantId,
        service.name,
        service.description,
        service.keywords,
        service.duration,
        service.price,
        Boolean(service.depositAmount),
        service.depositAmount ?? null,
      ],
    );
    const serviceId = row.rows[0].id;
    serviceIds[service.key] = serviceId;
    await db.query(
      `insert into branch_services (tenant_id, branch_id, service_id, is_active)
         values ($1,$2,$3,true)`,
      [tenantId, branch.id, serviceId],
    );
    for (const proKey of service.pros) {
      await db.query(
        `insert into professional_services (tenant_id, professional_id, service_id)
           values ($1,$2,$3)`,
        [tenantId, proIds[proKey], serviceId],
      );
    }
  }

  const clientIds = [];
  for (const client of CLIENTS) {
    const row = await db.query(
      `insert into clients (tenant_id, name, phone_e164, notes)
         values ($1,$2,$3,$4) returning id`,
      [tenantId, client.name, client.phone, client.notes ?? null],
    );
    clientIds.push(row.rows[0].id);
  }

  for (const item of APPOINTMENTS) {
    const service = SERVICES.find((entry) => entry.key === item.service);
    const startsAt = localDate(item, item.hour);
    const endsAt = new Date(startsAt.getTime() + service.duration * 60_000);
    const deposit = depositFor(service);
    const verified =
      deposit && item.status !== 'pending_deposit'
        ? new Date(startsAt.getTime() - 24 * 60 * 60 * 1000)
        : null;

    await db.query(
      `insert into appointments (
           tenant_id, branch_id, client_id, booking_contact_client_id, professional_id,
           service_id, starts_at, ends_at, status, price, currency,
           deposit_amount, deposit_verified_at, deposit_verified_by_user_id
         ) values ($1,$2,$3,$3,$4,$5,$6,$7,$8,$9,'BOB',$10,$11,$12)`,
      [
        tenantId,
        branch.id,
        clientIds[item.client],
        proIds[item.pro],
        serviceIds[item.service],
        startsAt.toISOString(),
        endsAt.toISOString(),
        item.status,
        service.price,
        deposit,
        verified ? verified.toISOString() : null,
        verified ? (owner?.id ?? null) : null,
      ],
    );
  }

  await db.query(
    `insert into schedule_blocks
         (tenant_id, branch_id, professional_id, starts_at, ends_at, reason, is_active)
       values ($1,null,$2,$3,$4,$5,true)`,
    [
      tenantId,
      proIds.mateo,
      localDate({ future: 5 }, 8).toISOString(),
      localDate({ future: 5 }, 13).toISOString(),
      'Congreso de pediatría',
    ],
  );

  return (
    `catalog: ${PROFESSIONALS.length} professionals, ${SERVICES.length} services, ` +
    `${CLIENTS.length} patients, ${APPOINTMENTS.length} appointments`
  );
}

async function seedDepositQr(db, { tenantId }) {
  const existing = await db.query(
    'select label from deposit_qrs where tenant_id = $1 and is_active',
    [tenantId],
  );
  if (existing.rows.length > 0) {
    return `deposit QR: skipped, "${existing.rows[0].label}" is already active`;
  }

  const assetPath = join(SCRIPT_DIR, 'assets', 'deposit-qr-demo.png');
  const body = await readFile(assetPath);
  const storageKey = `tenants/${tenantId}/deposit-qrs/${randomUUID()}.png`;
  const storageRoot = process.env.STORAGE_LOCAL_PATH ?? './storage';
  await mkdir(dirname(join(storageRoot, storageKey)), { recursive: true });
  await writeFile(join(storageRoot, storageKey), body);

  await db.query(
    `insert into deposit_qrs
       (tenant_id, branch_id, label, storage_key, mime_type, size_bytes, is_default, is_active)
     values ($1, null, $2, $3, 'image/png', $4, true, true)`,
    [tenantId, 'QR Banco (demo clínica)', storageKey, body.byteLength],
  );
  return 'deposit QR: tenant default written';
}

async function seedFaq(db, { tenantId }) {
  await db.query(
    `update business_configs
       set faq = $2::jsonb, business_category = 'medical', agent_name = 'Vale'
     where tenant_id = $1`,
    [tenantId, JSON.stringify(FAQ)],
  );
  return 'faq and medical category: updated';
}

async function main() {
  const password =
    process.env.CLINIC_OWNER_PASSWORD || randomBytes(9).toString('base64url');
  const passwordHash = await bcrypt.hash(password, 10);

  const db = new Client({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT || 5432),
    user: process.env.DB_USERNAME,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
  });
  await db.connect();

  try {
    console.log(await ensureMedicalCategory(db));
    const planId = await ensureProPlan(db);

    await db.query('BEGIN');
    const tenant = await ensureTenant(db, { passwordHash });
    await db.query('COMMIT');

    const branch = (
      await db.query(
        'select id from branches where tenant_id = $1 order by is_primary desc limit 1',
        [tenant.tenantId],
      )
    ).rows[0];
    const owner = (
      await db.query(
        "select id from users where tenant_id = $1 and role = 'owner' limit 1",
        [tenant.tenantId],
      )
    ).rows[0];

    const context = { tenantId: tenant.tenantId, branch, owner };
    console.log(
      `Tenant ${tenant.tenantId} (${tenant.created ? 'created' : 'existing'})`,
    );
    console.log(
      `  ${await assignProPlan(db, { tenantId: tenant.tenantId, planId })}`,
    );

    for (const step of [seedCatalog, seedDepositQr, seedFaq]) {
      await db.query('BEGIN');
      try {
        const summary = await step(db, context);
        await db.query('COMMIT');
        console.log(`  ${summary}`);
      } catch (error) {
        await db.query('ROLLBACK').catch(() => undefined);
        throw error;
      }
    }

    if (tenant.created) {
      console.log(`Login owner: ${OWNER_EMAIL}`);
      console.log(`Login staff: ${STAFF_EMAIL}`);
      console.log(`Password: ${password}`);
    } else {
      console.log(`Login owner already existed: ${OWNER_EMAIL}`);
    }
  } finally {
    await db.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
