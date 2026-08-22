import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';

import { AppModule } from '../src/app.module';
import { ErrorCode } from '../src/domain/common/exceptions';

const PASSWORD = 'Secreta123';

// Smallest valid PNG. Uploads are rejected unless the bytes really are the declared
// image type, and whatever is stored here can end up sent to a client over WhatsApp.
const PNG_BYTES = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
);

// Runs against the local database: it seeds two tenants and checks that nothing
// crosses from one to the other.
describe('Multi-tenancy (e2e)', () => {
  let app: INestApplication;
  let ritmoOwner: string;
  let ritmoStaff: string;
  let pasitosOwner: string;
  let superadmin: string;

  const login = async (email: string): Promise<string> => {
    const response = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email, password: PASSWORD })
      .expect(200);

    return response.body.token;
  };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }),
    );
    await app.init();

    await request(app.getHttpServer()).post('/api/v1/seed').expect(200);

    ritmoOwner = await login('ana@glow.test');
    ritmoStaff = await login('luis@glow.test');
    pasitosOwner = await login('marta@luna.test');
    superadmin = await login('soporte@nuvi.test');
  });

  afterAll(async () => {
    await app.close();
  });

  it('each owner only sees the users of their own tenant', async () => {
    const ritmo = await request(app.getHttpServer())
      .get('/api/v1/users')
      .set('Authorization', `Bearer ${ritmoOwner}`)
      .expect(200);
    const pasitos = await request(app.getHttpServer())
      .get('/api/v1/users')
      .set('Authorization', `Bearer ${pasitosOwner}`)
      .expect(200);

    const emailsOf = (body: { email: string }[]) =>
      body.map((user) => user.email).sort();

    expect(emailsOf(ritmo.body)).toEqual([
      'ana@glow.test',
      'luis@glow.test',
      'patricia@glow.test',
    ]);
    expect(emailsOf(pasitos.body)).toEqual([
      'marta@luna.test',
      'rocio@luna.test',
    ]);
  });

  it('a user of another tenant does not exist for the caller', async () => {
    const pasitos = await request(app.getHttpServer())
      .get('/api/v1/users')
      .set('Authorization', `Bearer ${pasitosOwner}`)
      .expect(200);
    const foreignId = pasitos.body[0].id;

    const response = await request(app.getHttpServer())
      .delete(`/api/v1/users/${foreignId}`)
      .set('Authorization', `Bearer ${ritmoOwner}`)
      .expect(404);

    expect(response.body.code).toBe(ErrorCode.USER_NOT_FOUND);
  });

  it('staff cannot create users', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/v1/users')
      .set('Authorization', `Bearer ${ritmoStaff}`)
      .send({
        name: 'Intruso',
        email: 'intruso@ritmo.test',
        password: PASSWORD,
        role: 'staff',
      })
      .expect(403);

    expect(response.body.code).toBe(ErrorCode.INSUFFICIENT_ROLE);
  });

  it('an owner cannot reach the support endpoints', async () => {
    await request(app.getHttpServer())
      .get('/api/v1/tenants')
      .set('Authorization', `Bearer ${ritmoOwner}`)
      .expect(403);
  });

  it('a superadmin cannot reach tenant-scoped endpoints', async () => {
    await request(app.getHttpServer())
      .get('/api/v1/users')
      .set('Authorization', `Bearer ${superadmin}`)
      .expect(403);
  });

  it('/tenants/me resolves the tenant from the token, not from the payload', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/v1/tenants/me')
      .set('Authorization', `Bearer ${ritmoOwner}`)
      .expect(200);

    expect(response.body.name).toBe('Estética Glow');
  });

  it('a user created by an owner lands in the owner tenant', async () => {
    const created = await request(app.getHttpServer())
      .post('/api/v1/users')
      .set('Authorization', `Bearer ${ritmoOwner}`)
      .send({
        name: 'Nueva Recepción',
        email: 'recepcion@ritmo.test',
        password: PASSWORD,
        role: 'staff',
      })
      .expect(201);

    const pasitos = await request(app.getHttpServer())
      .get('/api/v1/users')
      .set('Authorization', `Bearer ${pasitosOwner}`)
      .expect(200);

    expect(created.body.tenantId).toBeDefined();
    expect(pasitos.body.map((user: { id: string }) => user.id)).not.toContain(
      created.body.id,
    );
  });

  it('business configuration is tenant-scoped, readable by staff and written by the owner', async () => {
    const ritmo = await request(app.getHttpServer())
      .get('/api/v1/business-config')
      .set('Authorization', `Bearer ${ritmoOwner}`)
      .expect(200);
    const pasitos = await request(app.getHttpServer())
      .get('/api/v1/business-config')
      .set('Authorization', `Bearer ${pasitosOwner}`)
      .expect(200);

    expect(ritmo.body.slug).toBe('estetica-glow');
    expect(pasitos.body.slug).toBe('spa-luna');
    expect(ritmo.body).not.toHaveProperty('tenantId');

    // Staff reads it to paint the agenda grid, but cannot change it.
    const staffView = await request(app.getHttpServer())
      .get('/api/v1/business-config')
      .set('Authorization', `Bearer ${ritmoStaff}`)
      .expect(200);
    expect(staffView.body.slug).toBe('estetica-glow');

    await request(app.getHttpServer())
      .patch('/api/v1/business-config')
      .set('Authorization', `Bearer ${ritmoStaff}`)
      .send({ agentName: 'Luna' })
      .expect(403);
  });

  it('only support changes the trade the agent is set up for', async () => {
    const glow = await request(app.getHttpServer())
      .get('/api/v1/tenants/me')
      .set('Authorization', `Bearer ${ritmoOwner}`)
      .expect(200);

    await request(app.getHttpServer())
      .patch('/api/v1/business-config')
      .set('Authorization', `Bearer ${ritmoOwner}`)
      .send({ businessCategory: 'spa' })
      .expect(400);

    await request(app.getHttpServer())
      .patch(`/api/v1/tenants/${glow.body.id}/business-category`)
      .set('Authorization', `Bearer ${ritmoOwner}`)
      .send({ businessCategory: 'spa' })
      .expect(403);

    const changed = await request(app.getHttpServer())
      .patch(`/api/v1/tenants/${glow.body.id}/business-category`)
      .set('Authorization', `Bearer ${superadmin}`)
      .send({ businessCategory: 'spa' })
      .expect(200);
    expect(changed.body.businessCategory).toBe('spa');

    const seenByOwner = await request(app.getHttpServer())
      .get('/api/v1/business-config')
      .set('Authorization', `Bearer ${ritmoOwner}`)
      .expect(200);
    expect(seenByOwner.body.businessCategory).toBe('spa');

    await request(app.getHttpServer())
      .patch(`/api/v1/tenants/${glow.body.id}/business-category`)
      .set('Authorization', `Bearer ${superadmin}`)
      .send({ businessCategory: 'esthetics' })
      .expect(200);
  });

  it('keeps the agent voice of one tenant out of the other', async () => {
    await request(app.getHttpServer())
      .patch('/api/v1/business-config')
      .set('Authorization', `Bearer ${ritmoOwner}`)
      .send({
        agentPolicy: {
          handoffAutoResumeMinutes: 30,
          emojiPolicy: 'none',
          businessNotes: '## Parqueo **atrás**',
        },
      })
      .expect(200);

    const glow = await request(app.getHttpServer())
      .get('/api/v1/business-config')
      .set('Authorization', `Bearer ${ritmoOwner}`)
      .expect(200);
    const luna = await request(app.getHttpServer())
      .get('/api/v1/business-config')
      .set('Authorization', `Bearer ${pasitosOwner}`)
      .expect(200);

    expect(glow.body.agentPolicy).toMatchObject({
      handoffAutoResumeMinutes: 30,
      emojiPolicy: 'none',
      businessNotes: 'Parqueo atrás',
    });
    expect(luna.body.agentPolicy.emojiPolicy).toBe('light');
    expect(luna.body.agentPolicy.businessNotes).toBeNull();
  });

  it('an owner can configure the catalog with valid E1 rules', async () => {
    const configured = await request(app.getHttpServer())
      .patch('/api/v1/business-config')
      .set('Authorization', `Bearer ${ritmoOwner}`)
      .send({
        agentName: 'Nuna',
      })
      .expect(200);
    expect(configured.body.agentName).toBe('Nuna');

    const weeklyHours = {
      mon: { start: '09:00', end: '18:00' },
      tue: { start: '09:00', end: '18:00' },
      wed: { start: '09:00', end: '18:00' },
      thu: { start: '09:00', end: '18:00' },
      fri: { start: '09:00', end: '18:00' },
      sat: { start: '09:00', end: '13:00' },
      sun: null,
    };

    const professional = await request(app.getHttpServer())
      .post('/api/v1/professionals')
      .set('Authorization', `Bearer ${ritmoOwner}`)
      .send({
        name: 'Laura Méndez',
        weeklyHours,
      })
      .expect(201);

    const service = await request(app.getHttpServer())
      .post('/api/v1/services')
      .set('Authorization', `Bearer ${ritmoOwner}`)
      .send({
        name: 'Masaje relajante',
        durationMinutes: 60,
        price: '180.00',
        requiresDeposit: true,
        depositPercent: 30,
        professionalIds: [professional.body.id],
      })
      .expect(201);
    expect(service.body.depositPercent).toBe(30);
    expect(service.body.price).toEqual({
      amount: '180.00',
      currency: 'BOB',
      symbol: 'Bs',
    });

    const withoutDeposit = await request(app.getHttpServer())
      .patch(`/api/v1/services/${service.body.id}`)
      .set('Authorization', `Bearer ${ritmoOwner}`)
      .send({ requiresDeposit: false })
      .expect(200);
    expect(withoutDeposit.body.depositAmount).toBeNull();
    expect(withoutDeposit.body.depositPercent).toBeNull();
  });

  it('professional and service catalogs never cross tenants', async () => {
    const ritmoProfessionals = await request(app.getHttpServer())
      .get('/api/v1/professionals')
      .set('Authorization', `Bearer ${ritmoOwner}`)
      .expect(200);
    const pasitosProfessionals = await request(app.getHttpServer())
      .get('/api/v1/professionals')
      .set('Authorization', `Bearer ${pasitosOwner}`)
      .expect(200);
    const foreignProfessionalId = pasitosProfessionals.body[0].id;

    expect(
      ritmoProfessionals.body.map((item: { id: string }) => item.id),
    ).not.toContain(foreignProfessionalId);
    await request(app.getHttpServer())
      .patch(`/api/v1/professionals/${foreignProfessionalId}`)
      .set('Authorization', `Bearer ${ritmoOwner}`)
      .send({ name: 'No permitido' })
      .expect(404);

    const ritmoServices = await request(app.getHttpServer())
      .get('/api/v1/services')
      .set('Authorization', `Bearer ${ritmoOwner}`)
      .expect(200);
    const pasitosServices = await request(app.getHttpServer())
      .get('/api/v1/services')
      .set('Authorization', `Bearer ${pasitosOwner}`)
      .expect(200);
    const foreignServiceId = pasitosServices.body[0].id;

    expect(
      ritmoServices.body.map((item: { id: string }) => item.id),
    ).not.toContain(foreignServiceId);
    await request(app.getHttpServer())
      .patch(`/api/v1/services/${foreignServiceId}`)
      .set('Authorization', `Bearer ${ritmoOwner}`)
      .send({ name: 'No permitido' })
      .expect(404);
  });

  it('never returns the client book of another business', async () => {
    const glowClients = await request(app.getHttpServer())
      .get('/api/v1/clients')
      .set('Authorization', `Bearer ${ritmoOwner}`)
      .expect(200);
    const lunaClients = await request(app.getHttpServer())
      .get('/api/v1/clients')
      .set('Authorization', `Bearer ${pasitosOwner}`)
      .expect(200);

    const idsOf = (body: { data: { id: string }[] }) =>
      body.data.map((client) => client.id);
    const foreignClient = lunaClients.body.data[0];

    expect(glowClients.body.data.length).toBeGreaterThan(0);
    expect(idsOf(glowClients.body)).not.toContain(foreignClient.id);

    // Searching by the exact name of a client of the other business finds nothing.
    const search = await request(app.getHttpServer())
      .get('/api/v1/clients')
      .query({ search: foreignClient.name })
      .set('Authorization', `Bearer ${ritmoOwner}`)
      .expect(200);
    expect(search.body.data).toEqual([]);
  });

  it('a client created from the panel stays in the tenant of the caller', async () => {
    const created = await request(app.getHttpServer())
      .post('/api/v1/clients')
      .set('Authorization', `Bearer ${ritmoStaff}`)
      .send({ name: 'Walk-in Glow', phoneE164: '+59170000099' })
      .expect(201);

    const lunaSearch = await request(app.getHttpServer())
      .get('/api/v1/clients')
      .query({ search: 'Walk-in Glow' })
      .set('Authorization', `Bearer ${pasitosOwner}`)
      .expect(200);
    expect(lunaSearch.body.data).toEqual([]);

    // The same phone in the other business is a different client, not a conflict.
    const lunaClient = await request(app.getHttpServer())
      .post('/api/v1/clients')
      .set('Authorization', `Bearer ${pasitosOwner}`)
      .send({ name: 'Walk-in Luna', phoneE164: '+59170000099' })
      .expect(201);
    expect(lunaClient.body.id).not.toBe(created.body.id);

    // Registering an existing phone again returns the client instead of failing.
    const again = await request(app.getHttpServer())
      .post('/api/v1/clients')
      .set('Authorization', `Bearer ${ritmoStaff}`)
      .send({ name: 'Otro Nombre', phoneE164: '+59170000099' })
      .expect(201);
    expect(again.body.id).toBe(created.body.id);
    expect(again.body.name).toBe('Walk-in Glow');
  });

  it('keeps the payment QRs of one business out of the other', async () => {
    const uploadQr = (token: string, label: string) =>
      request(app.getHttpServer())
        .post('/api/v1/deposit-qrs')
        .set('Authorization', `Bearer ${token}`)
        .field('label', label)
        .attach('file', PNG_BYTES, {
          filename: 'qr.png',
          contentType: 'image/png',
        });

    const glowQr = await uploadQr(ritmoOwner, 'BNB Glow').expect(201);
    await uploadQr(pasitosOwner, 'Union Luna').expect(201);

    // The first QR of a business is its default: a single-QR business configures nothing.
    expect(glowQr.body.isDefault).toBe(true);

    const lunaList = await request(app.getHttpServer())
      .get('/api/v1/deposit-qrs')
      .set('Authorization', `Bearer ${pasitosOwner}`)
      .expect(200);
    expect(lunaList.body.map((qr: { id: string }) => qr.id)).not.toContain(
      glowQr.body.id,
    );

    await request(app.getHttpServer())
      .get(`/api/v1/deposit-qrs/${glowQr.body.id}/image`)
      .set('Authorization', `Bearer ${pasitosOwner}`)
      .expect(404);

    await request(app.getHttpServer())
      .patch(`/api/v1/deposit-qrs/${glowQr.body.id}`)
      .set('Authorization', `Bearer ${pasitosOwner}`)
      .send({ label: 'No permitido' })
      .expect(404);

    const image = await request(app.getHttpServer())
      .get(`/api/v1/deposit-qrs/${glowQr.body.id}/image`)
      .set('Authorization', `Bearer ${ritmoOwner}`)
      .expect(200);
    expect(image.headers['content-type']).toContain('image/png');

    await request(app.getHttpServer())
      .get('/api/v1/deposit-qrs')
      .set('Authorization', `Bearer ${ritmoStaff}`)
      .expect(403);
  });

  it('a service cannot be assigned the payment QR of another business', async () => {
    const lunaQrs = await request(app.getHttpServer())
      .get('/api/v1/deposit-qrs')
      .set('Authorization', `Bearer ${pasitosOwner}`)
      .expect(200);
    const glowServices = await request(app.getHttpServer())
      .get('/api/v1/services')
      .set('Authorization', `Bearer ${ritmoOwner}`)
      .expect(200);
    const withDeposit = glowServices.body.find(
      (service: { requiresDeposit: boolean }) => service.requiresDeposit,
    );

    const foreign = await request(app.getHttpServer())
      .patch(`/api/v1/services/${withDeposit.id}`)
      .set('Authorization', `Bearer ${ritmoOwner}`)
      .send({ depositQrId: lunaQrs.body[0].id })
      .expect(404);
    expect(foreign.body.code).toBe(ErrorCode.DEPOSIT_QR_NOT_FOUND);

    const glowQrs = await request(app.getHttpServer())
      .get('/api/v1/deposit-qrs')
      .set('Authorization', `Bearer ${ritmoOwner}`)
      .expect(200);

    const assigned = await request(app.getHttpServer())
      .patch(`/api/v1/services/${withDeposit.id}`)
      .set('Authorization', `Bearer ${ritmoOwner}`)
      .send({ depositQrId: glowQrs.body[0].id })
      .expect(200);
    expect(assigned.body.depositQrId).toBe(glowQrs.body[0].id);

    // Dropping the deposit drops the QR with it: the two cannot disagree.
    const withoutDeposit = await request(app.getHttpServer())
      .patch(`/api/v1/services/${withDeposit.id}`)
      .set('Authorization', `Bearer ${ritmoOwner}`)
      .send({ requiresDeposit: false })
      .expect(200);
    expect(withoutDeposit.body.depositQrId).toBeNull();
  });

  it('deactivates schedule blocks without deleting or leaking them', async () => {
    const professionals = await request(app.getHttpServer())
      .get('/api/v1/professionals')
      .set('Authorization', `Bearer ${ritmoOwner}`)
      .expect(200);

    const created = await request(app.getHttpServer())
      .post('/api/v1/schedule-blocks')
      .set('Authorization', `Bearer ${ritmoOwner}`)
      .send({
        professionalId: professionals.body[0].id,
        startsAt: '2030-08-10T12:00:00.000Z',
        endsAt: '2030-08-10T13:00:00.000Z',
        reason: 'Almuerzo',
      })
      .expect(201);

    const foreignList = await request(app.getHttpServer())
      .get('/api/v1/schedule-blocks')
      .query({
        from: '2030-08-01T00:00:00.000Z',
        to: '2030-09-01T00:00:00.000Z',
      })
      .set('Authorization', `Bearer ${pasitosOwner}`)
      .expect(200);
    expect(foreignList.body).toEqual([]);

    await request(app.getHttpServer())
      .patch(`/api/v1/schedule-blocks/${created.body.id}`)
      .set('Authorization', `Bearer ${ritmoOwner}`)
      .send({ isActive: false })
      .expect(200);

    const activeList = await request(app.getHttpServer())
      .get('/api/v1/schedule-blocks')
      .query({
        from: '2030-08-01T00:00:00.000Z',
        to: '2030-09-01T00:00:00.000Z',
      })
      .set('Authorization', `Bearer ${ritmoOwner}`)
      .expect(200);
    expect(activeList.body).toEqual([]);
  });

  it('rejects a request with no token', async () => {
    await request(app.getHttpServer()).get('/api/v1/users').expect(401);
  });

  it('keeps agent traces behind superadmin and scoped to the requested tenant', async () => {
    await request(app.getHttpServer())
      .get('/api/v1/admin/agent-traces/conversations')
      .query({ tenantId: '00000000-0000-0000-0000-000000000001' })
      .set('Authorization', `Bearer ${ritmoOwner}`)
      .expect(403);

    const tenants = await request(app.getHttpServer())
      .get('/api/v1/tenants')
      .set('Authorization', `Bearer ${superadmin}`)
      .expect(200);

    const glow = tenants.body.find(
      (tenant: { name: string }) => tenant.name === 'Estética Glow',
    );
    const luna = tenants.body.find(
      (tenant: { name: string }) => tenant.name === 'Spa Luna',
    );
    expect(glow?.id).toBeDefined();
    expect(luna?.id).toBeDefined();

    const glowList = await request(app.getHttpServer())
      .get('/api/v1/admin/agent-traces/conversations')
      .query({ tenantId: glow.id })
      .set('Authorization', `Bearer ${superadmin}`)
      .expect(200);
    expect(Array.isArray(glowList.body.data)).toBe(true);

    const missingConversation = '00000000-0000-4000-8000-000000000099';
    await request(app.getHttpServer())
      .get(`/api/v1/admin/agent-traces/conversations/${missingConversation}`)
      .query({ tenantId: glow.id })
      .set('Authorization', `Bearer ${superadmin}`)
      .expect(404);

    // Asking for a conversation under the other tenant still 404s: the scope is
    // the query tenantId, never a cross-tenant peek.
    if (glowList.body.data[0]) {
      await request(app.getHttpServer())
        .get(
          `/api/v1/admin/agent-traces/conversations/${glowList.body.data[0].conversation.id}`,
        )
        .query({ tenantId: luna.id })
        .set('Authorization', `Bearer ${superadmin}`)
        .expect(404);
    }

    await request(app.getHttpServer())
      .get('/api/v1/admin/agent-traces/00000000-0000-4000-8000-000000000098')
      .query({ tenantId: glow.id })
      .set('Authorization', `Bearer ${superadmin}`)
      .expect(404);

    await request(app.getHttpServer())
      .post('/api/v1/admin/agent-traces/prune')
      .set('Authorization', `Bearer ${ritmoOwner}`)
      .send({ tenantId: glow.id, olderThanDays: 30 })
      .expect(403);

    await request(app.getHttpServer())
      .post('/api/v1/admin/agent-traces/prune')
      .set('Authorization', `Bearer ${superadmin}`)
      .send({ tenantId: glow.id, olderThanDays: 30 })
      .expect(200);
  });
});
