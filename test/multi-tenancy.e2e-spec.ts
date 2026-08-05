import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';

import { AppModule } from '../src/app.module';
import { ErrorCode } from '../src/domain/common/exceptions';

const PASSWORD = 'Secreta123';

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

    expect(emailsOf(ritmo.body)).toEqual(['ana@glow.test', 'luis@glow.test']);
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

  it('business configuration is tenant-scoped and owner-only', async () => {
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

    expect(glow.body.agentPolicy).toEqual({
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
        businessHours: {
          mon: { start: '09:00', end: '18:00' },
          tue: { start: '09:00', end: '18:00' },
          wed: { start: '09:00', end: '18:00' },
          thu: { start: '09:00', end: '18:00' },
          fri: { start: '09:00', end: '18:00' },
          sat: { start: '09:00', end: '13:00' },
          sun: null,
        },
      })
      .expect(200);
    expect(configured.body.agentName).toBe('Nuna');

    const professional = await request(app.getHttpServer())
      .post('/api/v1/professionals')
      .set('Authorization', `Bearer ${ritmoOwner}`)
      .send({
        name: 'Laura Méndez',
        weeklyHours: configured.body.businessHours,
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
});
