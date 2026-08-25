// Demo catalog for a pilot tenant that already exists (owner + primary branch).
// Unlike SeedUseCase it never creates a tenant, so it is safe to point at a live
// database. Each step below skips itself when its data is already there, so the
// script can be re-run to fill in only what is missing.
//
//   docker compose -f docker-compose.prod.yaml exec api node scripts/seed-pilot.mjs
//
// Set SEED_TENANT_ID to target a specific business, FORCE=1 to add a second copy
// of the catalog on top of the existing professionals.
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';

import pg from 'pg';

const { Client } = pg;

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));

// America/La_Paz has no DST, so a fixed offset keeps the local hours below honest.
const LA_PAZ_OFFSET_HOURS = 4;

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
    sat: { start: '10:00', end: '13:00' },
    sun: null,
  },
  afternoon: {
    mon: { start: '13:00', end: '18:00' },
    tue: { start: '13:00', end: '18:00' },
    wed: { start: '13:00', end: '18:00' },
    thu: { start: '13:00', end: '18:00' },
    fri: { start: '13:00', end: '18:00' },
    sat: { start: '09:00', end: '13:00' },
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
  { key: 'camila', name: 'Camila Rojas', hours: HOURS.full },
  { key: 'daniela', name: 'Daniela Soto', hours: HOURS.late },
  { key: 'valeria', name: 'Valeria Mamani', hours: HOURS.afternoon },
  { key: 'jimena', name: 'Jimena Torrez', hours: HOURS.morning },
  {
    key: 'natalia',
    name: 'Natalia Vargas',
    hours: HOURS.full,
    isActive: false,
  },
];

const SERVICES = [
  {
    key: 'limpieza',
    name: 'Limpieza facial profunda',
    description: 'Extracción de puntos negros, vapor y mascarilla calmante.',
    keywords: ['limpieza de cara', 'facial', 'limpieza profunda'],
    duration: 60,
    price: '150.00',
    pros: ['camila', 'valeria', 'jimena'],
  },
  {
    key: 'hidrafacial',
    name: 'Hidrafacial',
    description: 'Hidratación profunda con punta de diamante.',
    keywords: ['hidra', 'hidrafacial', 'hidratacion facial'],
    duration: 75,
    price: '280.00',
    depositAmount: '50.00',
    pros: ['camila'],
  },
  {
    key: 'peeling',
    name: 'Peeling químico',
    description: 'Renovación celular con ácidos. Requiere evaluación previa.',
    keywords: ['peeling', 'acido', 'renovacion'],
    duration: 45,
    price: '220.00',
    depositPercent: 30,
    pros: ['camila', 'jimena'],
  },
  {
    key: 'manicure',
    name: 'Manicure spa',
    description: 'Limado, cutícula, exfoliación e hidratación de manos.',
    keywords: ['manicure', 'manos', 'uñas'],
    duration: 45,
    price: '80.00',
    clientChooses: false,
    pros: ['daniela'],
  },
  {
    key: 'pedicure',
    name: 'Pedicure spa',
    description: 'Baño de pies, limado y esmaltado tradicional.',
    keywords: ['pedicure', 'pies'],
    duration: 60,
    price: '100.00',
    clientChooses: false,
    pros: ['daniela'],
  },
  {
    key: 'semipermanente',
    name: 'Esmaltado semipermanente',
    description: 'Esmaltado en gel con lámpara UV, dura 3 semanas.',
    keywords: ['semipermanente', 'gel', 'esmaltado'],
    duration: 50,
    price: '110.00',
    clientChooses: false,
    pros: ['daniela'],
  },
  {
    key: 'maquillaje',
    name: 'Maquillaje social',
    description: 'Maquillaje para eventos, incluye pestañas postizas.',
    keywords: ['maquillaje', 'make up', 'evento'],
    duration: 60,
    price: '180.00',
    depositAmount: '40.00',
    pros: ['daniela', 'valeria'],
  },
  {
    key: 'novia',
    name: 'Maquillaje de novia',
    description: 'Prueba previa incluida. Se agenda con anticipación.',
    keywords: ['novia', 'boda', 'matrimonio'],
    duration: 90,
    price: '350.00',
    depositAmount: '100.00',
    pros: ['valeria'],
    questions: [
      { prompt: '¿Tenés alguna alergia a cosméticos?', kind: 'text' },
      { prompt: '¿Querés incluir la prueba de maquillaje?', kind: 'yes_no' },
    ],
  },
  {
    key: 'laser-axilas',
    name: 'Depilación láser axilas',
    description: 'Sesión de láser diodo. Se recomienda serie de 6.',
    keywords: ['laser', 'axilas', 'depilacion'],
    duration: 30,
    price: '120.00',
    pros: ['valeria', 'jimena'],
    questions: [{ prompt: '¿Es tu primera sesión de láser?', kind: 'yes_no' }],
  },
  {
    key: 'masaje',
    name: 'Masaje relajante 60 min',
    description: 'Masaje descontracturante de espalda y cuello.',
    keywords: ['masaje', 'relajante', 'descontracturante'],
    duration: 60,
    price: '160.00',
    pros: ['valeria'],
  },
  {
    key: 'cejas',
    name: 'Diseño de cejas',
    description: 'Perfilado con pinza y henna opcional.',
    keywords: ['cejas', 'perfilado', 'henna'],
    duration: 30,
    price: '70.00',
    pros: ['daniela', 'jimena'],
  },
];

const CLIENTS = [
  {
    name: 'Rocío Salazar',
    phone: '+59171110001',
    notes: 'Piel sensible, evitar ácidos fuertes.',
  },
  { name: 'Andrea Villarroel', phone: '+59171110002' },
  {
    name: 'Gabriela Mendoza',
    phone: '+59171110003',
    notes: 'Prefiere turnos por la mañana.',
  },
  { name: 'Lucía Ferrufino', phone: '+59171110004' },
  {
    name: 'Mariana Céspedes',
    phone: '+59171110005',
    notes: 'Se casa en noviembre.',
  },
  { name: 'Paola Guzmán', phone: '+59171110006' },
  {
    name: 'Fernanda Ledezma',
    phone: '+59171110007',
    notes: 'Llegó por Instagram.',
  },
  { name: 'Carla Arispe', phone: '+59171110008' },
];

// `past`/`future` count business days, never weekends, so every hour below falls
// inside both the branch and the professional's Mon–Fri window.
const APPOINTMENTS = [
  {
    client: 0,
    pro: 'camila',
    service: 'limpieza',
    past: 8,
    hour: 10,
    status: 'attended',
  },
  {
    client: 1,
    pro: 'daniela',
    service: 'semipermanente',
    past: 7,
    hour: 11,
    status: 'attended',
  },
  {
    client: 2,
    pro: 'jimena',
    service: 'cejas',
    past: 6,
    hour: 9,
    status: 'attended',
  },
  {
    client: 3,
    pro: 'valeria',
    service: 'masaje',
    past: 5,
    hour: 14,
    status: 'no_show',
  },
  {
    client: 4,
    pro: 'camila',
    service: 'hidrafacial',
    past: 4,
    hour: 15,
    status: 'attended',
  },
  {
    client: 5,
    pro: 'daniela',
    service: 'manicure',
    past: 3,
    hour: 16,
    status: 'cancelled',
  },
  {
    client: 6,
    pro: 'valeria',
    service: 'laser-axilas',
    past: 2,
    hour: 15,
    status: 'attended',
  },
  {
    client: 7,
    pro: 'camila',
    service: 'peeling',
    past: 1,
    hour: 11,
    status: 'attended',
  },

  {
    client: 0,
    pro: 'camila',
    service: 'limpieza',
    future: 0,
    hour: 16,
    status: 'confirmed',
  },
  {
    client: 1,
    pro: 'daniela',
    service: 'manicure',
    future: 0,
    hour: 11,
    status: 'confirmed',
  },
  {
    client: 2,
    pro: 'jimena',
    service: 'cejas',
    future: 0,
    hour: 10,
    status: 'confirmed',
  },
  {
    client: 5,
    pro: 'camila',
    service: 'hidrafacial',
    future: 1,
    hour: 9,
    status: 'confirmed',
  },
  {
    client: 3,
    pro: 'valeria',
    service: 'masaje',
    future: 1,
    hour: 14,
    status: 'confirmed',
  },
  {
    client: 4,
    pro: 'valeria',
    service: 'novia',
    future: 1,
    hour: 16,
    status: 'pending_deposit',
  },
  {
    client: 7,
    pro: 'jimena',
    service: 'limpieza',
    future: 2,
    hour: 11,
    status: 'confirmed',
  },
  {
    client: 6,
    pro: 'daniela',
    service: 'maquillaje',
    future: 2,
    hour: 15,
    status: 'pending_deposit',
  },
  {
    client: 0,
    pro: 'daniela',
    service: 'pedicure',
    future: 3,
    hour: 10,
    status: 'confirmed',
  },
  {
    client: 1,
    pro: 'camila',
    service: 'peeling',
    future: 3,
    hour: 14,
    status: 'pending_deposit',
  },
  {
    client: 2,
    pro: 'valeria',
    service: 'laser-axilas',
    future: 4,
    hour: 13,
    status: 'confirmed',
  },
  {
    client: 3,
    pro: 'camila',
    service: 'limpieza',
    future: 5,
    hour: 10,
    status: 'confirmed',
  },
  {
    client: 4,
    pro: 'daniela',
    service: 'semipermanente',
    future: 6,
    hour: 12,
    status: 'confirmed',
  },
  {
    client: 5,
    pro: 'jimena',
    service: 'laser-axilas',
    future: 8,
    hour: 9,
    status: 'confirmed',
  },
];

const BLOCKS = [
  {
    pro: 'valeria',
    future: 5,
    startHour: 13,
    endHour: 18,
    reason: 'Capacitación de láser',
  },
  {
    pro: null,
    future: 7,
    startHour: 9,
    endHour: 18,
    reason: 'Feriado — local cerrado',
  },
];

// The image is a scannable QR whose payload says it is a test, so nobody mistakes
// it for a real account if a client scans what the agent sends.
const DEPOSIT_QR = {
  label: 'Banco Demo (prueba)',
  assetPath: join(SCRIPT_DIR, 'assets', 'deposit-qr-demo.png'),
  mimeType: 'image/png',
};

const FAQ = {
  ubicacion: 'Estamos en Av. Heroínas 123, entre Antezana y 25 de Mayo.',
  pagos: 'Aceptamos QR bancario, transferencia y efectivo.',
  estacionamiento: 'Hay parqueo público a media cuadra.',
  llegada: 'Te pedimos llegar 10 minutos antes de tu turno.',
  cancelaciones: 'Podés reagendar hasta 24 horas antes sin cargo.',
};

// Midnight of today's La Paz calendar date, held as a UTC date for day arithmetic.
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
  if (service.depositAmount) return service.depositAmount;
  if (service.depositPercent) {
    const value = (Number(service.price) * service.depositPercent) / 100;
    return value.toFixed(2);
  }
  return null;
}

// Mirrors UploadDepositQrUseCase: bytes land in the object storage root under the
// same key layout, so the app serves this QR through its normal read path.
async function seedDepositQr(db, { tenantId }) {
  const existing = await db.query(
    'select label from deposit_qrs where tenant_id = $1 and is_active',
    [tenantId],
  );
  if (existing.rows.length > 0) {
    return `deposit QR: skipped, "${existing.rows[0].label}" is already active`;
  }

  const body = await readFile(DEPOSIT_QR.assetPath);
  const storageKey = `tenants/${tenantId}/deposit-qrs/${randomUUID()}.png`;
  const storageRoot = process.env.STORAGE_LOCAL_PATH ?? './storage';
  const fullPath = join(storageRoot, storageKey);

  await mkdir(dirname(fullPath), { recursive: true });
  await writeFile(fullPath, body);

  await db.query(
    `insert into deposit_qrs
       (tenant_id, branch_id, label, storage_key, mime_type, size_bytes, is_default, is_active)
     values ($1, null, $2, $3, $4, $5, true, true)`,
    [
      tenantId,
      DEPOSIT_QR.label,
      storageKey,
      DEPOSIT_QR.mimeType,
      body.byteLength,
    ],
  );

  return `deposit QR: "${DEPOSIT_QR.label}" set as tenant default (${body.byteLength} bytes)`;
}

async function seedCatalog(db, { tenantId, branch, owner }) {
  const existing = await db.query(
    'select count(*)::int as n from professionals where tenant_id = $1',
    [tenantId],
  );
  if (existing.rows[0].n > 0 && process.env.FORCE !== '1') {
    return `catalog: skipped, tenant already has ${existing.rows[0].n} professional(s). Set FORCE=1 to seed anyway`;
  }

  const proIds = {};
  for (const pro of PROFESSIONALS) {
    const row = await db.query(
      `insert into professionals (tenant_id, name, is_active)
         values ($1, $2, $3) returning id`,
      [tenantId, pro.name, pro.isActive !== false],
    );
    proIds[pro.key] = row.rows[0].id;
    await db.query(
      `insert into branch_professionals (tenant_id, branch_id, professional_id, weekly_hours, is_active)
         values ($1, $2, $3, $4::jsonb, $5)`,
      [
        tenantId,
        branch.id,
        row.rows[0].id,
        JSON.stringify(pro.hours),
        pro.isActive !== false,
      ],
    );
  }

  const serviceIds = {};
  for (const service of SERVICES) {
    const row = await db.query(
      `insert into services (
           tenant_id, name, description, keywords, duration_minutes, currency, price,
           requires_deposit, deposit_amount, deposit_percent, client_chooses_professional, is_active
         ) values ($1,$2,$3,$4::text[],$5,'BOB',$6,$7,$8,$9,$10,true) returning id`,
      [
        tenantId,
        service.name,
        service.description ?? null,
        service.keywords ?? [],
        service.duration,
        service.price,
        Boolean(service.depositAmount || service.depositPercent),
        service.depositAmount ?? null,
        service.depositPercent ?? null,
        service.clientChooses !== false,
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

    for (const [index, question] of (service.questions ?? []).entries()) {
      await db.query(
        `insert into service_booking_questions
             (tenant_id, service_id, prompt, kind, is_required, sort_order, is_active)
           values ($1,$2,$3,$4,true,$5,true)`,
        [tenantId, serviceId, question.prompt, question.kind, index],
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

  let appointmentCount = 0;
  for (const item of APPOINTMENTS) {
    const service = SERVICES.find((s) => s.key === item.service);
    const startsAt = localDate(item, item.hour);
    const endsAt = new Date(startsAt.getTime() + service.duration * 60_000);
    const deposit = depositFor(service);
    const verified =
      deposit && item.status !== 'pending_deposit'
        ? new Date(startsAt.getTime() - 24 * 60 * 60 * 1000)
        : null;

    const appointment = await db.query(
      `insert into appointments (
           tenant_id, branch_id, client_id, booking_contact_client_id, professional_id,
           service_id, starts_at, ends_at, status, price, currency,
           deposit_amount, deposit_verified_at, deposit_verified_by_user_id
         ) values ($1,$2,$3,$3,$4,$5,$6,$7,$8,$9,'BOB',$10,$11,$12) returning id`,
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

    for (const question of service.questions ?? []) {
      await db.query(
        `insert into appointment_booking_answers
             (tenant_id, appointment_id, prompt_snapshot, kind, value)
           values ($1,$2,$3,$4,$5)`,
        [
          tenantId,
          appointment.rows[0].id,
          question.prompt,
          question.kind,
          question.kind === 'yes_no' ? 'si' : 'Ninguna',
        ],
      );
    }
    appointmentCount += 1;
  }

  for (const block of BLOCKS) {
    await db.query(
      `insert into schedule_blocks
           (tenant_id, branch_id, professional_id, starts_at, ends_at, reason, is_active)
         values ($1,$2,$3,$4,$5,$6,true)`,
      [
        tenantId,
        block.pro ? null : branch.id,
        block.pro ? proIds[block.pro] : null,
        localDate(block, block.startHour).toISOString(),
        localDate(block, block.endHour).toISOString(),
        block.reason,
      ],
    );
  }

  return (
    `catalog: ${PROFESSIONALS.length} professionals, ${SERVICES.length} services, ` +
    `${CLIENTS.length} clients, ${appointmentCount} appointments, ` +
    `${BLOCKS.length} schedule blocks`
  );
}

async function seedFaq(db, { tenantId }) {
  const updated = await db.query(
    `update business_configs set faq = $2::jsonb
     where tenant_id = $1 and faq = '{}'::jsonb`,
    [tenantId, JSON.stringify(FAQ)],
  );
  return updated.rowCount > 0
    ? `faq: ${Object.keys(FAQ).length} entries written`
    : 'faq: skipped, the business already answered these';
}

async function resolveContext(db) {
  const tenantId =
    process.env.SEED_TENANT_ID ??
    (await db.query('select id from tenants order by created_at limit 1'))
      .rows[0]?.id;
  if (!tenantId) throw new Error('No tenant found. Bootstrap an owner first.');

  const branch = (
    await db.query(
      'select id from branches where tenant_id = $1 order by is_primary desc limit 1',
      [tenantId],
    )
  ).rows[0];
  if (!branch) throw new Error('Tenant has no branch.');

  const owner = (
    await db.query(
      "select id from users where tenant_id = $1 and role = 'owner' limit 1",
      [tenantId],
    )
  ).rows[0];

  return { tenantId, branch, owner };
}

async function main() {
  const db = new Client({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT || 5432),
    user: process.env.DB_USERNAME,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
  });
  await db.connect();

  try {
    const context = await resolveContext(db);
    console.log(`Seeding tenant ${context.tenantId}`);

    // One transaction per step so a skipped or failing step never leaves the
    // others half applied.
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
  } finally {
    await db.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
