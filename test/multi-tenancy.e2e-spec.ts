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

    ritmoOwner = await login('ana@ritmo.test');
    ritmoStaff = await login('luis@ritmo.test');
    pasitosOwner = await login('marta@pasitos.test');
    superadmin = await login('soporte@cobrai.test');
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

    expect(emailsOf(ritmo.body)).toEqual(['ana@ritmo.test', 'luis@ritmo.test']);
    expect(emailsOf(pasitos.body)).toEqual([
      'marta@pasitos.test',
      'rocio@pasitos.test',
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

    expect(response.body.name).toBe('Academia de Danza Ritmo');
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

  it('rejects a request with no token', async () => {
    await request(app.getHttpServer()).get('/api/v1/users').expect(401);
  });
});
