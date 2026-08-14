#!/usr/bin/env node
/**
 * Dev only. Grows the demo tenant into a big salon: a team of ~15 professionals with
 * mixed shifts, linked to the catalogue, with appointments spread over the next few days.
 * It exists to see what the agenda looks like at a density the fixtures never reach — a
 * day view with fifteen columns is a different screen from one with three.
 *
 * Only adds: unlike `POST /api/v1/seed`, nothing here wipes data, and running it twice
 * skips the professionals and clients it already created.
 *
 * Usage (backend and database up):
 *   node scripts/dev/seed-demo-team.mjs
 *   API=http://localhost:3010/api/v1 EMAIL=ana@glow.test PASSWORD=Secreta123 \
 *     DAYS=3 node scripts/dev/seed-demo-team.mjs
 */

const API = process.env.API ?? 'http://localhost:3010/api/v1';
const EMAIL = process.env.EMAIL ?? 'ana@glow.test';
const PASSWORD = process.env.PASSWORD ?? 'Secreta123';
const DAYS = Number(process.env.DAYS ?? 3);

// The panel renders every hour in the zone of the business, so the slots below are wall
// clock there and this is what turns them into instants. La Paz has no DST.
const BUSINESS_UTC_OFFSET_HOURS = 4;

const FULL_TIME = {
  mon: { start: '09:00', end: '18:00' },
  tue: { start: '09:00', end: '18:00' },
  wed: { start: '09:00', end: '18:00' },
  thu: { start: '09:00', end: '18:00' },
  fri: { start: '09:00', end: '18:00' },
  sat: { start: '09:00', end: '13:00' },
  sun: null,
};

const MORNINGS = {
  mon: { start: '09:00', end: '13:00' },
  tue: { start: '09:00', end: '13:00' },
  wed: { start: '09:00', end: '13:00' },
  thu: { start: '09:00', end: '13:00' },
  fri: { start: '09:00', end: '13:00' },
  sat: { start: '09:00', end: '13:00' },
  sun: null,
};

const AFTERNOONS = {
  mon: { start: '13:00', end: '18:00' },
  tue: { start: '13:00', end: '18:00' },
  wed: { start: '13:00', end: '18:00' },
  thu: { start: '13:00', end: '18:00' },
  fri: { start: '13:00', end: '18:00' },
  sat: null,
  sun: null,
};

// Three days a week: the gaps are the point, they are what the shaded hours have to show.
const PART_TIME = {
  mon: null,
  tue: { start: '10:00', end: '18:00' },
  wed: null,
  thu: { start: '10:00', end: '18:00' },
  fri: null,
  sat: { start: '09:00', end: '13:00' },
  sun: null,
};

const TEAM = [
  { name: 'Andrea Terceros', weeklyHours: FULL_TIME },
  { name: 'Gabriela Ponce', weeklyHours: MORNINGS },
  { name: 'Fernanda Ríos', weeklyHours: AFTERNOONS },
  { name: 'Mariela Chávez', weeklyHours: FULL_TIME },
  { name: 'Rocío Villarroel', weeklyHours: PART_TIME },
  { name: 'Paola Antelo', weeklyHours: FULL_TIME },
  { name: 'Karen Durán', weeklyHours: MORNINGS },
  { name: 'Noelia Sandoval', weeklyHours: AFTERNOONS },
  { name: 'Jimena Aramayo', weeklyHours: FULL_TIME },
  { name: 'Belén Ortuño', weeklyHours: PART_TIME },
  { name: 'Cecilia Mendoza', weeklyHours: FULL_TIME },
];

const CLIENTS = [
  { name: 'Lucía Ferrufino', phoneE164: '+59171000101' },
  { name: 'Micaela Vargas', phoneE164: '+59171000102' },
  { name: 'Tatiana Sejas', phoneE164: '+59171000103' },
  { name: 'Wara Choque', phoneE164: '+59171000104' },
  { name: 'Ximena Bilbao', phoneE164: '+59171000105' },
  { name: 'Alejandra Nogales', phoneE164: '+59171000106' },
  { name: 'Silvia Encinas', phoneE164: '+59171000107' },
  { name: 'Rosario Guzmán', phoneE164: '+59171000108' },
];

let token = '';

const call = async (path, { method = 'GET', body } = {}) => {
  const response = await fetch(`${API}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });

  const text = await response.text();
  const payload = text ? JSON.parse(text) : null;

  if (!response.ok) {
    const error = new Error(
      `${method} ${path} → ${response.status} ${JSON.stringify(payload)}`,
    );
    error.status = response.status;
    throw error;
  }

  return payload;
};

/** Every list endpoint answers either an array or a page of one. */
const listOf = (payload) => (Array.isArray(payload) ? payload : payload.data);

const isoAt = (day, minutesFromMidnight) => {
  const date = new Date(day);
  date.setUTCHours(
    Math.floor(minutesFromMidnight / 60) + BUSINESS_UTC_OFFSET_HOURS,
    minutesFromMidnight % 60,
    0,
    0,
  );

  return date.toISOString();
};

const businessToday = () => {
  const now = new Date();
  now.setUTCHours(now.getUTCHours() - BUSINESS_UTC_OFFSET_HOURS);
  return new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
  );
};

const main = async () => {
  const login = await call('/auth/login', {
    method: 'POST',
    body: { email: EMAIL, password: PASSWORD },
  });
  token = login.token;

  const branches = listOf(await call('/branches'));
  const branch = branches.find((item) => item.isPrimary) ?? branches[0];

  const existing = listOf(await call('/professionals'));
  const known = new Set(existing.map((item) => item.name));

  let created = 0;
  for (const member of TEAM) {
    if (known.has(member.name)) continue;

    await call('/professionals', { method: 'POST', body: member });
    created += 1;
  }
  console.log(`professionals: ${created} created, ${known.size} already there`);

  const team = listOf(await call('/professionals')).filter(
    (item) => item.isActive,
  );

  // Two thirds of the team per service: everyone doing everything reads as fake, and a
  // service nobody does cannot be booked at all.
  const services = listOf(await call('/services')).filter(
    (item) => item.isActive,
  );
  const offeredBy = new Map();

  for (const [serviceIndex, service] of services.entries()) {
    const chosen = team.filter((_, index) => (index + serviceIndex) % 3 !== 0);
    const professionalIds = chosen.length > 0 ? chosen : [team[0]];

    await call(`/services/${service.id}`, {
      method: 'PATCH',
      body: { professionalIds: professionalIds.map((item) => item.id) },
    });

    for (const professional of professionalIds) {
      const list = offeredBy.get(professional.id) ?? [];
      list.push(service);
      offeredBy.set(professional.id, list);
    }
  }
  console.log(`services: ${services.length} relinked to the team`);

  const clients = listOf(await call('/clients?limit=100'));
  const knownClients = new Set(clients.map((item) => item.phoneE164));

  for (const client of CLIENTS) {
    if (knownClients.has(client.phoneE164)) continue;
    await call('/clients', { method: 'POST', body: client });
  }

  const roster = listOf(await call('/clients?limit=100'));

  let booked = 0;
  let refused = 0;
  const start = businessToday();

  for (let offset = 0; offset < DAYS; offset += 1) {
    const day = new Date(start);
    day.setUTCDate(day.getUTCDate() + offset);
    // Sunday the salon is closed, so nothing can be booked into it.
    if (day.getUTCDay() === 0) continue;

    for (const [index, professional] of team.entries()) {
      const catalogue = offeredBy.get(professional.id) ?? services;
      if (catalogue.length === 0) continue;

      // A different starting hour per column, so the grid does not come out striped.
      let cursor = 9 * 60 + ((index * 30 + offset * 60) % 180);

      for (let slot = 0; slot < 3; slot += 1) {
        const service = catalogue[(index + slot + offset) % catalogue.length];
        const client = roster[(index * 3 + slot + offset) % roster.length];

        try {
          await call('/appointments', {
            method: 'POST',
            body: {
              clientId: client.id,
              professionalId: professional.id,
              serviceId: service.id,
              branchId: branch.id,
              startsAt: isoAt(day, cursor),
            },
          });
          booked += 1;
        } catch {
          // Outside the shift or already taken: the next slot is tried instead.
          refused += 1;
        }

        cursor += service.durationMinutes + 30;
      }
    }
  }

  console.log(
    `appointments: ${booked} booked over ${DAYS} day(s), ${refused} slots refused`,
  );
  console.log(`team is now ${team.length} professionals at ${branch.name}`);
};

main().catch((error) => {
  console.error(error.message ?? error);
  process.exit(1);
});
