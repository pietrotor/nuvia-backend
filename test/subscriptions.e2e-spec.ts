import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';

import { AppModule } from '../src/app.module';
import { ErrorCode } from '../src/domain/common/exceptions';

const PASSWORD = 'Secreta123';

describe('Subscriptions (e2e)', () => {
  let app: INestApplication;
  let glowOwner: string;
  let lunaOwner: string;
  let superadmin: string;

  const login = async (email: string): Promise<string> => {
    const response = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email, password: PASSWORD })
      .expect(200);

    return response.body.token as string;
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

    glowOwner = await login('ana@glow.test');
    lunaOwner = await login('marta@luna.test');
    superadmin = await login('soporte@nuvi.test');
  });

  afterAll(async () => {
    await app.close();
  });

  it('returns the current subscription with usage meters for the owner', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/v1/subscriptions/me')
      .set('Authorization', `Bearer ${glowOwner}`)
      .expect(200);

    expect(response.body.plan.code).toBe('starter');
    expect(response.body.status).toBe('active');
    expect(response.body.quotas[0].key).toBe('aiRepliesPerPeriod');
    expect(response.body.quotas[0].limit).toBe(500);
    expect(response.body.quotas[0].used).toBe(0);
    expect(response.body.caps).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ key: 'professionals', used: 4, limit: 5 }),
        expect.objectContaining({ key: 'branches', used: 2, limit: 2 }),
      ]),
    );
  });

  it('keeps subscription usage isolated between tenants', async () => {
    const glow = await request(app.getHttpServer())
      .get('/api/v1/subscriptions/me')
      .set('Authorization', `Bearer ${glowOwner}`)
      .expect(200);
    const luna = await request(app.getHttpServer())
      .get('/api/v1/subscriptions/me')
      .set('Authorization', `Bearer ${lunaOwner}`)
      .expect(200);

    expect(glow.body.id).not.toBe(luna.body.id);
    expect(glow.body.plan.code).toBe('starter');
    expect(luna.body.plan.code).toBe('trial');
    expect(luna.body.status).toBe('trialing');
  });

  it('gives the clinic demo the pro plan and seven professionals', async () => {
    const clinicOwner = await login('sofia@lospinos.test');
    const response = await request(app.getHttpServer())
      .get('/api/v1/subscriptions/me')
      .set('Authorization', `Bearer ${clinicOwner}`)
      .expect(200);

    expect(response.body.plan.code).toBe('pro');
    expect(response.body.status).toBe('active');
    expect(response.body.caps).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          key: 'professionals',
          used: 7,
          limit: 12,
        }),
      ]),
    );

    const config = await request(app.getHttpServer())
      .get('/api/v1/business-config')
      .set('Authorization', `Bearer ${clinicOwner}`)
      .expect(200);
    expect(config.body.businessCategory).toBe('medical');
    expect(config.body.lexicon.client).toBe('paciente');
    expect(config.body.lexicon.professionalPlural).toBe('médicos');
  });

  it('rejects owners from the admin plan endpoints', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/v1/admin/plans')
      .set('Authorization', `Bearer ${glowOwner}`)
      .expect(403);

    expect(response.body.code).toBe(ErrorCode.INSUFFICIENT_ROLE);
  });

  it('lets the superadmin list and create plans', async () => {
    const listed = await request(app.getHttpServer())
      .get('/api/v1/admin/plans')
      .set('Authorization', `Bearer ${superadmin}`)
      .expect(200);

    expect(listed.body.map((plan: { code: string }) => plan.code)).toEqual(
      expect.arrayContaining(['trial', 'starter', 'pro']),
    );

    const created = await request(app.getHttpServer())
      .post('/api/v1/admin/plans')
      .set('Authorization', `Bearer ${superadmin}`)
      .send({
        code: 'pro-e2e',
        name: 'Pro E2E',
        priceAmount: '700.00',
        config: {
          quotas: { aiRepliesPerPeriod: 2000 },
          caps: { professionals: 10 },
        },
      })
      .expect(201);

    expect(created.body.code).toBe('pro-e2e');
    expect(created.body.config.quotas.aiRepliesPerPeriod).toBe(2000);
  });
});
