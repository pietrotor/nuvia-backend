import { Inject, Injectable } from '@nestjs/common';

import {
  TENANT_REPOSITORY,
  TenantRepository,
} from '@domain/tenants/repositories/tenant.repository';
import {
  BUSINESS_CONFIG_REPOSITORY,
  BusinessConfigRepository,
} from '@domain/business-config/repositories/business-config.repository';
import {
  AgentTone,
  DEFAULT_AGENT_POLICY,
  WeeklyHours,
} from '@domain/business-config/entities/business-config.entity';
import {
  USER_REPOSITORY,
  UserRepository,
} from '@domain/users/repositories/user.repository';
import { BusinessCategory } from '@domain/business-config/value-objects/business-category.vo';
import { Role } from '@domain/users/value-objects/role.vo';
import { ErrorCode, ForbiddenError } from '@domain/common/exceptions';
import { Currency } from '@domain/common/value-objects/currency.vo';
import {
  PROFESSIONAL_REPOSITORY,
  ProfessionalRepository,
} from '@domain/professionals/repositories/professional.repository';
import {
  SERVICE_REPOSITORY,
  ServiceRepository,
} from '@domain/services/repositories/service.repository';
import {
  CLIENT_REPOSITORY,
  ClientRepository,
} from '@domain/clients/repositories/client.repository';
import {
  APPOINTMENT_REPOSITORY,
  AppointmentRepository,
} from '@domain/appointments/repositories/appointment.repository';
import {
  SCHEDULE_BLOCK_REPOSITORY,
  ScheduleBlockRepository,
} from '@domain/schedule-blocks/repositories/schedule-block.repository';
import {
  PASSWORD_HASHER_PORT,
  PasswordHasherPort,
} from '@domain/users/ports/password-hasher.port';
import {
  TENANT_CONTEXT_PORT,
  TenantContextPort,
} from '@domain/tenants/ports/tenant-context.port';
import {
  RUNTIME_ENVIRONMENT_PORT,
  RuntimeEnvironmentPort,
} from '@domain/common/ports/runtime-environment.port';

const SEED_PASSWORD = 'Secreta123';

const WEEKDAY_9_18: WeeklyHours = {
  mon: { start: '09:00', end: '18:00' },
  tue: { start: '09:00', end: '18:00' },
  wed: { start: '09:00', end: '18:00' },
  thu: { start: '09:00', end: '18:00' },
  fri: { start: '09:00', end: '18:00' },
  sat: { start: '09:00', end: '13:00' },
  sun: null,
};

const WEEKDAY_10_19: WeeklyHours = {
  mon: { start: '10:00', end: '19:00' },
  tue: { start: '10:00', end: '19:00' },
  wed: { start: '10:00', end: '19:00' },
  thu: { start: '10:00', end: '19:00' },
  fri: { start: '10:00', end: '19:00' },
  sat: { start: '10:00', end: '14:00' },
  sun: null,
};

const AFTERNOON_HOURS: WeeklyHours = {
  mon: { start: '13:00', end: '20:00' },
  tue: { start: '13:00', end: '20:00' },
  wed: { start: '13:00', end: '20:00' },
  thu: { start: '13:00', end: '20:00' },
  fri: { start: '13:00', end: '20:00' },
  sat: { start: '09:00', end: '15:00' },
  sun: null,
};

const WEEKEND_INCLUSIVE: WeeklyHours = {
  mon: { start: '09:00', end: '17:00' },
  tue: { start: '09:00', end: '17:00' },
  wed: { start: '09:00', end: '17:00' },
  thu: { start: '09:00', end: '17:00' },
  fri: { start: '09:00', end: '17:00' },
  sat: { start: '09:00', end: '16:00' },
  sun: { start: '10:00', end: '14:00' },
};

type SeedService = {
  name: string;
  durationMinutes: number;
  price: string;
  requiresDeposit?: boolean;
  depositAmount?: string;
  depositPercent?: number;
  professionalKeys: string[];
};

type SeedFixture = {
  name: string;
  slug: string;
  businessCategory: BusinessCategory;
  address: string;
  owner: { name: string; email: string };
  staff: { name: string; email: string };
  businessHours: WeeklyHours;
  faq: Record<string, string>;
  professionals: { key: string; name: string; weeklyHours: WeeklyHours }[];
  services: SeedService[];
  clients: { name: string; phoneE164: string }[];
};

const FIXTURES: SeedFixture[] = [
  {
    name: 'Estética Glow',
    slug: 'estetica-glow',
    businessCategory: BusinessCategory.ESTHETICS,
    address: 'Av. Heroínas 123, Cochabamba',
    owner: { name: 'Ana Quiroga', email: 'ana@glow.test' },
    staff: { name: 'Luis Paz', email: 'luis@glow.test' },
    businessHours: WEEKDAY_9_18,
    faq: {
      ubicacion:
        'Av. Heroínas 123, Cochabamba. Estamos a 2 cuadras de la Plaza 14 de Septiembre.',
      pagos:
        'Aceptamos QR bancario, transferencia y efectivo. Las señas se pagan por QR.',
      estacionamiento: 'Hay parqueo público a media cuadra.',
      llegada:
        'Te pedimos llegar 10 minutos antes. Si vas a demorar, avisanos por WhatsApp.',
    },
    professionals: [
      {
        key: 'camila',
        name: 'Camila Rojas',
        weeklyHours: WEEKDAY_9_18,
      },
      {
        key: 'daniela',
        name: 'Daniela Soto',
        weeklyHours: WEEKDAY_10_19,
      },
      {
        key: 'valeria',
        name: 'Valeria Mamani',
        weeklyHours: AFTERNOON_HOURS,
      },
    ],
    services: [
      {
        name: 'Limpieza facial profunda',
        durationMinutes: 60,
        price: '150.00',
        professionalKeys: ['camila', 'valeria'],
      },
      {
        name: 'Hidrafacial',
        durationMinutes: 75,
        price: '280.00',
        requiresDeposit: true,
        depositAmount: '50.00',
        professionalKeys: ['camila'],
      },
      {
        name: 'Peeling químico',
        durationMinutes: 45,
        price: '220.00',
        requiresDeposit: true,
        depositPercent: 30,
        professionalKeys: ['camila'],
      },
      {
        name: 'Manicure spa',
        durationMinutes: 45,
        price: '80.00',
        professionalKeys: ['daniela'],
      },
      {
        name: 'Pedicure spa',
        durationMinutes: 60,
        price: '100.00',
        professionalKeys: ['daniela'],
      },
      {
        name: 'Maquillaje social',
        durationMinutes: 60,
        price: '180.00',
        requiresDeposit: true,
        depositAmount: '40.00',
        professionalKeys: ['daniela', 'valeria'],
      },
      {
        name: 'Depilación láser axilas',
        durationMinutes: 30,
        price: '120.00',
        professionalKeys: ['valeria'],
      },
      {
        name: 'Masaje relajante 60 min',
        durationMinutes: 60,
        price: '160.00',
        professionalKeys: ['valeria'],
      },
    ],
    clients: [
      { name: 'Cliente Demo', phoneE164: '+59170000001' },
      { name: 'María Fernanda', phoneE164: '+59170000011' },
      { name: 'Paola Choque', phoneE164: '+59170000012' },
    ],
  },
  {
    name: 'Spa Luna',
    slug: 'spa-luna',
    businessCategory: BusinessCategory.SPA,
    address: 'Calle España 456, Cochabamba',
    owner: { name: 'Marta Vargas', email: 'marta@luna.test' },
    staff: { name: 'Rocío Díaz', email: 'rocio@luna.test' },
    businessHours: WEEKEND_INCLUSIVE,
    faq: {
      ubicacion: 'Calle España 456, Cochabamba, cerca del Prado.',
      pagos: 'QR y efectivo. Señas obligatorias en tratamientos corporales.',
      ninos: 'Atendemos desde los 16 años con acompañante.',
      cancelaciones:
        'Podés cancelar o reagendar hasta 24 horas antes sin cargo.',
    },
    professionals: [
      {
        key: 'sofia',
        name: 'Sofía Arce',
        weeklyHours: WEEKEND_INCLUSIVE,
      },
      {
        key: 'andrea',
        name: 'Andrea Flores',
        weeklyHours: WEEKDAY_10_19,
      },
      {
        key: 'lucia',
        name: 'Lucía Quispe',
        weeklyHours: AFTERNOON_HOURS,
      },
    ],
    services: [
      {
        name: 'Masaje descontracturante',
        durationMinutes: 60,
        price: '170.00',
        professionalKeys: ['sofia', 'lucia'],
      },
      {
        name: 'Masaje con piedras calientes',
        durationMinutes: 90,
        price: '250.00',
        requiresDeposit: true,
        depositAmount: '60.00',
        professionalKeys: ['sofia'],
      },
      {
        name: 'Envolturas corporales',
        durationMinutes: 75,
        price: '210.00',
        requiresDeposit: true,
        depositPercent: 25,
        professionalKeys: ['andrea'],
      },
      {
        name: 'Limpieza facial luminosa',
        durationMinutes: 50,
        price: '140.00',
        professionalKeys: ['andrea', 'lucia'],
      },
      {
        name: 'Drenaje linfático',
        durationMinutes: 60,
        price: '190.00',
        professionalKeys: ['lucia'],
      },
      {
        name: 'Ritual spa pareja',
        durationMinutes: 120,
        price: '450.00',
        requiresDeposit: true,
        depositAmount: '100.00',
        professionalKeys: ['sofia', 'andrea'],
      },
    ],
    clients: [
      { name: 'Cliente Luna', phoneE164: '+59170000002' },
      { name: 'Carla Méndez', phoneE164: '+59170000021' },
    ],
  },
];

export interface SeedResult {
  tenants: { id: string; name: string; owner: string; staff: string }[];
  superadmin: string;
}

@Injectable()
export class SeedUseCase {
  constructor(
    @Inject(TENANT_REPOSITORY)
    private readonly tenantRepository: TenantRepository,
    @Inject(BUSINESS_CONFIG_REPOSITORY)
    private readonly businessConfigRepository: BusinessConfigRepository,
    @Inject(USER_REPOSITORY)
    private readonly userRepository: UserRepository,
    @Inject(PROFESSIONAL_REPOSITORY)
    private readonly professionalRepository: ProfessionalRepository,
    @Inject(SERVICE_REPOSITORY)
    private readonly serviceRepository: ServiceRepository,
    @Inject(CLIENT_REPOSITORY)
    private readonly clientRepository: ClientRepository,
    @Inject(APPOINTMENT_REPOSITORY)
    private readonly appointmentRepository: AppointmentRepository,
    @Inject(SCHEDULE_BLOCK_REPOSITORY)
    private readonly scheduleBlockRepository: ScheduleBlockRepository,
    @Inject(PASSWORD_HASHER_PORT)
    private readonly passwordHasher: PasswordHasherPort,
    @Inject(TENANT_CONTEXT_PORT)
    private readonly tenantContext: TenantContextPort,
    @Inject(RUNTIME_ENVIRONMENT_PORT)
    private readonly runtimeEnvironment: RuntimeEnvironmentPort,
  ) {}

  async execute(): Promise<SeedResult> {
    if (this.runtimeEnvironment.isProduction()) {
      throw new ForbiddenError(ErrorCode.SEED_DISABLED);
    }

    await this.appointmentRepository.deleteAllUnscoped();
    await this.scheduleBlockRepository.deleteAllUnscoped();
    await this.clientRepository.deleteAllUnscoped();
    await this.serviceRepository.deleteAllUnscoped();
    await this.professionalRepository.deleteAllUnscoped();
    await this.userRepository.deleteAllUnscoped();
    await this.businessConfigRepository.deleteAllUnscoped();
    await this.tenantRepository.deleteAll();

    const password = await this.passwordHasher.hash(SEED_PASSWORD);

    const superadmin = await this.userRepository.createSuperadminUnscoped({
      name: 'Soporte Nuvi',
      email: 'soporte@nuvi.test',
      password,
    });

    const tenants: SeedResult['tenants'] = [];

    for (const fixture of FIXTURES) {
      const tenant = await this.tenantRepository.create({
        name: fixture.name,
      });

      await this.tenantContext.runWithTenant(tenant.id, async () => {
        await this.businessConfigRepository.create({
          slug: fixture.slug,
          agentName: 'Vale',
          tone: AgentTone.WARM,
          businessCategory: fixture.businessCategory,
          address: fixture.address,
          businessHours: fixture.businessHours,
          bookingPolicy: {
            minLeadTimeHours: 2,
            cancelRescheduleHours: 24,
            noShowMessage:
              'Si no podés asistir, avisanos con anticipación para liberar el horario.',
          },
          agentPolicy: DEFAULT_AGENT_POLICY,
          faq: fixture.faq,
        });

        await this.userRepository.create({
          ...fixture.owner,
          password,
          role: Role.OWNER,
        });
        await this.userRepository.create({
          ...fixture.staff,
          password,
          role: Role.STAFF,
        });

        const professionalIds = new Map<string, string>();
        for (const professional of fixture.professionals) {
          const created = await this.professionalRepository.create({
            name: professional.name,
            weeklyHours: professional.weeklyHours,
          });
          professionalIds.set(professional.key, created.id);
        }

        for (const service of fixture.services) {
          await this.serviceRepository.create({
            name: service.name,
            durationMinutes: service.durationMinutes,
            currency: Currency.BOB,
            price: service.price,
            requiresDeposit: service.requiresDeposit ?? false,
            depositAmount: service.depositAmount ?? null,
            depositPercent: service.depositPercent ?? null,
            professionalIds: service.professionalKeys.map((key) => {
              const id = professionalIds.get(key);
              if (!id) {
                throw new Error(`Unknown professional key: ${key}`);
              }
              return id;
            }),
          });
        }

        for (const client of fixture.clients) {
          await this.clientRepository.create(client);
        }
      });

      tenants.push({
        id: tenant.id,
        name: tenant.name,
        owner: fixture.owner.email,
        staff: fixture.staff.email,
      });
    }

    return { tenants, superadmin: superadmin.email };
  }
}
