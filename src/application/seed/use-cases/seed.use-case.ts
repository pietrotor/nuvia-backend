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
  BRANCH_REPOSITORY,
  BranchRepository,
} from '@domain/branches/repositories/branch.repository';
import {
  BRANCH_PROFESSIONAL_REPOSITORY,
  BranchProfessionalRepository,
} from '@domain/branches/repositories/branch-professional.repository';
import {
  BRANCH_SERVICE_REPOSITORY,
  BranchServiceRepository,
} from '@domain/branches/repositories/branch-service.repository';
import {
  BRANCH_PROFESSIONAL_SERVICE_WINDOW_REPOSITORY,
  BranchProfessionalServiceWindowRepository,
} from '@domain/branches/repositories/branch-professional-service-window.repository';
import {
  USER_BRANCH_REPOSITORY,
  UserBranchRepository,
} from '@domain/branches/repositories/user-branch.repository';
import {
  PROFESSIONAL_REPOSITORY,
  ProfessionalRepository,
} from '@domain/professionals/repositories/professional.repository';
import {
  SERVICE_REPOSITORY,
  ServiceRepository,
} from '@domain/services/repositories/service.repository';
import {
  DEPOSIT_QR_REPOSITORY,
  DepositQrRepository,
} from '@domain/deposits/repositories/deposit-qr.repository';
import {
  CLIENT_REPOSITORY,
  ClientRepository,
} from '@domain/clients/repositories/client.repository';
import {
  CONVERSATION_REPOSITORY,
  ConversationRepository,
} from '@domain/conversations/repositories/conversation.repository';
import {
  APPOINTMENT_REPOSITORY,
  AppointmentRepository,
} from '@domain/appointments/repositories/appointment.repository';
import { AppointmentStatus } from '@domain/appointments/entities/appointment.entity';
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
import {
  PLAN_REPOSITORY,
  PlanRepository,
  TRIAL_PLAN_CODE,
} from '@domain/subscriptions/repositories/plan.repository';
import {
  SUBSCRIPTION_REPOSITORY,
  SubscriptionRepository,
} from '@domain/subscriptions/repositories/subscription.repository';
import { SubscriptionStatus } from '@domain/subscriptions/value-objects/subscription-status.vo';
import { Money } from '@domain/common/value-objects/money.vo';
import { EnsureTrialSubscriptionUseCase } from '@application/subscriptions/use-cases/ensure-trial-subscription.use-case';

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

const MORNING_ONLY: WeeklyHours = {
  mon: { start: '08:00', end: '13:00' },
  tue: { start: '08:00', end: '13:00' },
  wed: { start: '08:00', end: '13:00' },
  thu: { start: '08:00', end: '13:00' },
  fri: { start: '08:00', end: '13:00' },
  sat: null,
  sun: null,
};

type SeedService = {
  key: string;
  name: string;
  durationMinutes: number;
  price: string;
  requiresDeposit?: boolean;
  depositAmount?: string;
  depositPercent?: number;
  clientChoosesProfessional?: boolean;
  professionalKeys: string[];
};

type SeedBranch = {
  key: string;
  name: string;
  slug: string;
  address: string;
  phone?: string;
  weeklyHours: WeeklyHours;
  isPrimary?: boolean;
  professionalKeys: string[];
  // Service keys offered here. Optional price override for local pricing.
  services: { key: string; priceOverrideAmount?: string }[];
};

type SeedAppointment = {
  clientPhone: string;
  professionalKey: string;
  serviceKey: string;
  branchKey: string;
  // Offset in days from today at local noon-ish hours (hour/minute).
  dayOffset: number;
  hour: number;
  minute?: number;
  status: AppointmentStatus;
};

type SeedFixture = {
  name: string;
  slug: string;
  businessCategory: BusinessCategory;
  agentName: string;
  // Which plan the tenant ends on after the trial bootstrap.
  planCode: 'trial' | 'starter' | 'pro';
  subscriptionStatus: SubscriptionStatus;
  owner: { name: string; email: string; phone?: string };
  staff: { name: string; email: string; phone?: string }[];
  faq: Record<string, string>;
  professionals: {
    key: string;
    name: string;
    weeklyHours: WeeklyHours;
    isActive?: boolean;
  }[];
  services: SeedService[];
  branches: SeedBranch[];
  clients: { name: string; phoneE164: string; notes?: string }[];
  appointments: SeedAppointment[];
  // Professional key → block later this week (hours from now-ish).
  scheduleBlocks: {
    professionalKey?: string;
    branchKey?: string;
    dayOffset: number;
    startHour: number;
    endHour: number;
    reason: string;
  }[];
};

const FIXTURES: SeedFixture[] = [
  {
    name: 'Estética Glow',
    slug: 'estetica-glow',
    businessCategory: BusinessCategory.ESTHETICS,
    agentName: 'Vale',
    planCode: 'starter',
    subscriptionStatus: SubscriptionStatus.ACTIVE,
    owner: {
      name: 'Ana Quiroga',
      email: 'ana@glow.test',
      phone: '+59170001001',
    },
    staff: [
      { name: 'Luis Paz', email: 'luis@glow.test', phone: '+59170001002' },
      {
        name: 'Patricia Ríos',
        email: 'patricia@glow.test',
        phone: '+59170001003',
      },
    ],
    faq: {
      ubicacion:
        'Tenemos dos locales: Casa Matriz en Av. Heroínas 123 y Sucursal Norte en Av. América 890.',
      pagos:
        'Aceptamos QR bancario, transferencia y efectivo. Las señas se pagan por QR antes de confirmar.',
      estacionamiento:
        'En Casa Matriz hay parqueo público a media cuadra. En Norte hay estacionamiento propio.',
      llegada:
        'Te pedimos llegar 10 minutos antes. Si vas a demorar, avisanos por WhatsApp.',
      cancelaciones:
        'Podés cancelar o reagendar hasta 24 horas antes sin cargo. Después puede aplicarse la seña.',
      primeros_pasos:
        'Si es tu primera vez, la consulta de evaluación facial es gratis y dura 20 minutos.',
    },
    professionals: [
      { key: 'camila', name: 'Camila Rojas', weeklyHours: WEEKDAY_9_18 },
      { key: 'daniela', name: 'Daniela Soto', weeklyHours: WEEKDAY_10_19 },
      { key: 'valeria', name: 'Valeria Mamani', weeklyHours: AFTERNOON_HOURS },
      { key: 'jimena', name: 'Jimena Torrez', weeklyHours: MORNING_ONLY },
      {
        key: 'natalia',
        name: 'Natalia Vargas',
        weeklyHours: WEEKDAY_9_18,
        isActive: false,
      },
    ],
    services: [
      {
        key: 'limpieza',
        name: 'Limpieza facial profunda',
        durationMinutes: 60,
        price: '150.00',
        professionalKeys: ['camila', 'valeria', 'jimena'],
      },
      {
        key: 'hidrafacial',
        name: 'Hidrafacial',
        durationMinutes: 75,
        price: '280.00',
        requiresDeposit: true,
        depositAmount: '50.00',
        professionalKeys: ['camila'],
      },
      {
        key: 'peeling',
        name: 'Peeling químico',
        durationMinutes: 45,
        price: '220.00',
        requiresDeposit: true,
        depositPercent: 30,
        professionalKeys: ['camila', 'jimena'],
      },
      {
        key: 'manicure',
        name: 'Manicure spa',
        durationMinutes: 45,
        price: '80.00',
        clientChoosesProfessional: false,
        professionalKeys: ['daniela'],
      },
      {
        key: 'pedicure',
        name: 'Pedicure spa',
        durationMinutes: 60,
        price: '100.00',
        clientChoosesProfessional: false,
        professionalKeys: ['daniela'],
      },
      {
        key: 'semipermanente',
        name: 'Esmaltado semipermanente',
        durationMinutes: 50,
        price: '110.00',
        clientChoosesProfessional: false,
        professionalKeys: ['daniela'],
      },
      {
        key: 'maquillaje',
        name: 'Maquillaje social',
        durationMinutes: 60,
        price: '180.00',
        requiresDeposit: true,
        depositAmount: '40.00',
        professionalKeys: ['daniela', 'valeria'],
      },
      {
        key: 'maquillaje-novia',
        name: 'Maquillaje de novia',
        durationMinutes: 90,
        price: '350.00',
        requiresDeposit: true,
        depositAmount: '100.00',
        professionalKeys: ['valeria'],
      },
      {
        key: 'laser-axilas',
        name: 'Depilación láser axilas',
        durationMinutes: 30,
        price: '120.00',
        professionalKeys: ['valeria', 'jimena'],
      },
      {
        key: 'laser-piernas',
        name: 'Depilación láser piernas completas',
        durationMinutes: 60,
        price: '280.00',
        requiresDeposit: true,
        depositPercent: 25,
        professionalKeys: ['valeria'],
      },
      {
        key: 'masaje',
        name: 'Masaje relajante 60 min',
        durationMinutes: 60,
        price: '160.00',
        professionalKeys: ['valeria'],
      },
      {
        key: 'cejas',
        name: 'Diseño de cejas',
        durationMinutes: 30,
        price: '70.00',
        professionalKeys: ['camila', 'jimena', 'daniela'],
      },
      {
        key: 'evaluacion',
        name: 'Evaluación facial (primera vez)',
        durationMinutes: 20,
        price: '0.00',
        professionalKeys: ['camila', 'jimena'],
      },
      {
        key: 'radiofrecuencia',
        name: 'Radiofrecuencia facial',
        durationMinutes: 45,
        price: '190.00',
        requiresDeposit: true,
        depositAmount: '40.00',
        professionalKeys: ['camila'],
      },
    ],
    branches: [
      {
        key: 'matriz',
        name: 'Casa Matriz',
        slug: 'casa-matriz',
        address: 'Av. Heroínas 123, Cochabamba',
        phone: '+59144401001',
        weeklyHours: WEEKDAY_9_18,
        isPrimary: true,
        professionalKeys: ['camila', 'daniela', 'valeria', 'jimena', 'natalia'],
        services: [
          { key: 'limpieza' },
          { key: 'hidrafacial' },
          { key: 'peeling' },
          { key: 'manicure' },
          { key: 'pedicure' },
          { key: 'semipermanente' },
          { key: 'maquillaje' },
          { key: 'maquillaje-novia' },
          { key: 'laser-axilas' },
          { key: 'laser-piernas' },
          { key: 'masaje' },
          { key: 'cejas' },
          { key: 'evaluacion' },
          { key: 'radiofrecuencia' },
        ],
      },
      {
        key: 'norte',
        name: 'Sucursal Norte',
        slug: 'norte',
        address: 'Av. América 890, Cochabamba',
        phone: '+59144401002',
        weeklyHours: WEEKDAY_10_19,
        professionalKeys: ['camila', 'daniela', 'jimena'],
        services: [
          { key: 'limpieza', priceOverrideAmount: '160.00' },
          { key: 'hidrafacial', priceOverrideAmount: '300.00' },
          { key: 'manicure' },
          { key: 'pedicure' },
          { key: 'semipermanente' },
          { key: 'cejas' },
          { key: 'evaluacion' },
          { key: 'peeling' },
        ],
      },
    ],
    clients: [
      {
        name: 'Cliente Demo',
        phoneE164: '+59170000001',
        notes: 'Clienta de prueba para demos y WhatsApp.',
      },
      {
        name: 'María Fernanda López',
        phoneE164: '+59170000011',
        notes: 'Prefiere Camila. Piel sensible.',
      },
      {
        name: 'Paola Choque',
        phoneE164: '+59170000012',
        notes: 'Suele pedir manicure + pedicure el mismo día.',
      },
      {
        name: 'Andrea Guzmán',
        phoneE164: '+59170000013',
        notes: 'Novia el 20/09. Coordinar prueba de maquillaje.',
      },
      {
        name: 'Carla Méndez',
        phoneE164: '+59170000014',
      },
      {
        name: 'Sofía Arancibia',
        phoneE164: '+59170000015',
        notes: 'Alergia a algunos peelings. Confirmar ficha.',
      },
      {
        name: 'Jimena Paredes',
        phoneE164: '+59170000016',
      },
      {
        name: 'Valentina Rojas',
        phoneE164: '+59170000017',
        notes: 'Atiende en Sucursal Norte.',
      },
      {
        name: 'Daniela Flores',
        phoneE164: '+59170000018',
      },
      {
        name: 'Lucía Mamani',
        phoneE164: '+59170000019',
        notes: 'Plantón el mes pasado. Pedir seña siempre.',
      },
      {
        name: 'Patricia Quispe',
        phoneE164: '+59170000020',
      },
      {
        name: 'Camila Torrico',
        phoneE164: '+59170000021',
        notes: 'Paquete de láser en curso (referencia manual).',
      },
    ],
    appointments: [
      {
        clientPhone: '+59170000011',
        professionalKey: 'camila',
        serviceKey: 'hidrafacial',
        branchKey: 'matriz',
        dayOffset: 0,
        hour: 10,
        status: AppointmentStatus.CONFIRMED,
      },
      {
        clientPhone: '+59170000012',
        professionalKey: 'daniela',
        serviceKey: 'manicure',
        branchKey: 'matriz',
        dayOffset: 0,
        hour: 11,
        status: AppointmentStatus.CONFIRMED,
      },
      {
        clientPhone: '+59170000013',
        professionalKey: 'valeria',
        serviceKey: 'maquillaje-novia',
        branchKey: 'matriz',
        dayOffset: 1,
        hour: 9,
        status: AppointmentStatus.PENDING_DEPOSIT,
      },
      {
        clientPhone: '+59170000017',
        professionalKey: 'jimena',
        serviceKey: 'limpieza',
        branchKey: 'norte',
        dayOffset: 1,
        hour: 10,
        status: AppointmentStatus.CONFIRMED,
      },
      {
        clientPhone: '+59170000014',
        professionalKey: 'camila',
        serviceKey: 'peeling',
        branchKey: 'norte',
        dayOffset: 2,
        hour: 15,
        status: AppointmentStatus.CONFIRMED,
      },
      {
        clientPhone: '+59170000019',
        professionalKey: 'valeria',
        serviceKey: 'laser-piernas',
        branchKey: 'matriz',
        dayOffset: -2,
        hour: 16,
        status: AppointmentStatus.NO_SHOW,
      },
      {
        clientPhone: '+59170000015',
        professionalKey: 'camila',
        serviceKey: 'limpieza',
        branchKey: 'matriz',
        dayOffset: -1,
        hour: 11,
        status: AppointmentStatus.ATTENDED,
      },
      {
        clientPhone: '+59170000018',
        professionalKey: 'daniela',
        serviceKey: 'semipermanente',
        branchKey: 'matriz',
        dayOffset: 3,
        hour: 14,
        status: AppointmentStatus.CONFIRMED,
      },
    ],
    scheduleBlocks: [
      {
        professionalKey: 'camila',
        dayOffset: 3,
        startHour: 9,
        endHour: 13,
        reason: 'Curso de radiofrecuencia',
      },
      {
        branchKey: 'norte',
        dayOffset: 5,
        startHour: 9,
        endHour: 18,
        reason: 'Mantenimiento del local Norte',
      },
    ],
  },
  {
    name: 'Spa Luna',
    slug: 'spa-luna',
    businessCategory: BusinessCategory.SPA,
    agentName: 'Luna',
    planCode: 'trial',
    subscriptionStatus: SubscriptionStatus.TRIALING,
    owner: {
      name: 'Marta Vargas',
      email: 'marta@luna.test',
      phone: '+59170002001',
    },
    staff: [
      { name: 'Rocío Díaz', email: 'rocio@luna.test', phone: '+59170002002' },
    ],
    faq: {
      ubicacion: 'Calle España 456, Cochabamba, cerca del Prado.',
      pagos: 'QR y efectivo. Señas obligatorias en tratamientos corporales.',
      ninos: 'Atendemos desde los 16 años con acompañante.',
      cancelaciones:
        'Podés cancelar o reagendar hasta 24 horas antes sin cargo.',
      estacionamiento: 'Hay cochera propia para clientas con cita.',
      pareja:
        'El ritual spa pareja incluye dos camillas simultáneas; pedimos seña del 20%.',
    },
    professionals: [
      { key: 'sofia', name: 'Sofía Arce', weeklyHours: WEEKEND_INCLUSIVE },
      { key: 'andrea', name: 'Andrea Flores', weeklyHours: WEEKDAY_10_19 },
      { key: 'lucia', name: 'Lucía Quispe', weeklyHours: AFTERNOON_HOURS },
    ],
    services: [
      {
        key: 'descontracturante',
        name: 'Masaje descontracturante',
        durationMinutes: 60,
        price: '170.00',
        professionalKeys: ['sofia', 'lucia'],
      },
      {
        key: 'piedras',
        name: 'Masaje con piedras calientes',
        durationMinutes: 90,
        price: '250.00',
        requiresDeposit: true,
        depositAmount: '60.00',
        professionalKeys: ['sofia'],
      },
      {
        key: 'envolturas',
        name: 'Envolturas corporales',
        durationMinutes: 75,
        price: '210.00',
        requiresDeposit: true,
        depositPercent: 25,
        professionalKeys: ['andrea'],
      },
      {
        key: 'facial-luminosa',
        name: 'Limpieza facial luminosa',
        durationMinutes: 50,
        price: '140.00',
        professionalKeys: ['andrea', 'lucia'],
      },
      {
        key: 'drenaje',
        name: 'Drenaje linfático',
        durationMinutes: 60,
        price: '190.00',
        professionalKeys: ['lucia'],
      },
      {
        key: 'ritual-pareja',
        name: 'Ritual spa pareja',
        durationMinutes: 120,
        price: '450.00',
        requiresDeposit: true,
        depositAmount: '100.00',
        professionalKeys: ['sofia', 'andrea'],
      },
      {
        key: 'exfoliacion',
        name: 'Exfoliación corporal',
        durationMinutes: 45,
        price: '150.00',
        professionalKeys: ['andrea', 'lucia'],
      },
      {
        key: 'reflexologia',
        name: 'Reflexología podal',
        durationMinutes: 40,
        price: '120.00',
        professionalKeys: ['sofia', 'lucia'],
      },
      {
        key: 'chocolate',
        name: 'Envoltura de chocolate',
        durationMinutes: 60,
        price: '200.00',
        requiresDeposit: true,
        depositAmount: '40.00',
        professionalKeys: ['andrea'],
      },
      {
        key: 'consulta-spa',
        name: 'Consulta inicial spa',
        durationMinutes: 25,
        price: '0.00',
        professionalKeys: ['sofia', 'andrea', 'lucia'],
      },
    ],
    branches: [
      {
        key: 'matriz',
        name: 'Casa Matriz',
        slug: 'casa-matriz',
        address: 'Calle España 456, Cochabamba',
        phone: '+59144402001',
        weeklyHours: WEEKEND_INCLUSIVE,
        isPrimary: true,
        professionalKeys: ['sofia', 'andrea', 'lucia'],
        services: [
          { key: 'descontracturante' },
          { key: 'piedras' },
          { key: 'envolturas' },
          { key: 'facial-luminosa' },
          { key: 'drenaje' },
          { key: 'ritual-pareja' },
          { key: 'exfoliacion' },
          { key: 'reflexologia' },
          { key: 'chocolate' },
          { key: 'consulta-spa' },
        ],
      },
    ],
    clients: [
      {
        name: 'Cliente Luna',
        phoneE164: '+59170000002',
        notes: 'Clienta de prueba WhatsApp Spa Luna.',
      },
      {
        name: 'Carla Méndez',
        phoneE164: '+59170000031',
        notes: 'Prefiere Sofía para masajes.',
      },
      {
        name: 'Elena Vargas',
        phoneE164: '+59170000032',
      },
      {
        name: 'Mariana Soto',
        phoneE164: '+59170000033',
        notes: 'Viene en pareja. Ritual spa frecuente.',
      },
      {
        name: 'Gabriela León',
        phoneE164: '+59170000034',
      },
      {
        name: 'Fernanda Cruz',
        phoneE164: '+59170000035',
        notes: 'Problemas de circulación. Recomendar drenaje.',
      },
      {
        name: 'Adriana Pinto',
        phoneE164: '+59170000036',
      },
      {
        name: 'Roxana Aguilar',
        phoneE164: '+59170000037',
        notes: 'Alérgica a esencias cítricas.',
      },
    ],
    appointments: [
      {
        clientPhone: '+59170000031',
        professionalKey: 'sofia',
        serviceKey: 'piedras',
        branchKey: 'matriz',
        dayOffset: 0,
        hour: 11,
        status: AppointmentStatus.CONFIRMED,
      },
      {
        clientPhone: '+59170000033',
        professionalKey: 'andrea',
        serviceKey: 'ritual-pareja',
        branchKey: 'matriz',
        dayOffset: 2,
        hour: 10,
        status: AppointmentStatus.PENDING_DEPOSIT,
      },
      {
        clientPhone: '+59170000035',
        professionalKey: 'lucia',
        serviceKey: 'drenaje',
        branchKey: 'matriz',
        dayOffset: 1,
        hour: 15,
        status: AppointmentStatus.CONFIRMED,
      },
      {
        clientPhone: '+59170000032',
        professionalKey: 'andrea',
        serviceKey: 'facial-luminosa',
        branchKey: 'matriz',
        dayOffset: -1,
        hour: 12,
        status: AppointmentStatus.ATTENDED,
      },
    ],
    scheduleBlocks: [
      {
        professionalKey: 'sofia',
        dayOffset: 4,
        startHour: 14,
        endHour: 18,
        reason: 'Día personal',
      },
    ],
  },
];

function atLocal(dayOffset: number, hour: number, minute = 0): Date {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() + dayOffset);
  date.setHours(hour, minute, 0, 0);
  return date;
}

function addMinutes(date: Date, minutes: number): Date {
  return new Date(date.getTime() + minutes * 60_000);
}

function addMonths(date: Date, months: number): Date {
  const next = new Date(date);
  next.setUTCMonth(next.getUTCMonth() + months);
  return next;
}

export interface SeedResult {
  tenants: {
    id: string;
    name: string;
    owner: string;
    staff: string[];
    plan: string;
  }[];
  plans: string[];
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
    @Inject(BRANCH_REPOSITORY)
    private readonly branchRepository: BranchRepository,
    @Inject(BRANCH_PROFESSIONAL_REPOSITORY)
    private readonly branchProfessionalRepository: BranchProfessionalRepository,
    @Inject(BRANCH_SERVICE_REPOSITORY)
    private readonly branchServiceRepository: BranchServiceRepository,
    @Inject(BRANCH_PROFESSIONAL_SERVICE_WINDOW_REPOSITORY)
    private readonly serviceWindowRepository: BranchProfessionalServiceWindowRepository,
    @Inject(USER_BRANCH_REPOSITORY)
    private readonly userBranchRepository: UserBranchRepository,
    @Inject(PROFESSIONAL_REPOSITORY)
    private readonly professionalRepository: ProfessionalRepository,
    @Inject(SERVICE_REPOSITORY)
    private readonly serviceRepository: ServiceRepository,
    @Inject(DEPOSIT_QR_REPOSITORY)
    private readonly depositQrRepository: DepositQrRepository,
    @Inject(CLIENT_REPOSITORY)
    private readonly clientRepository: ClientRepository,
    @Inject(CONVERSATION_REPOSITORY)
    private readonly conversationRepository: ConversationRepository,
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
    @Inject(PLAN_REPOSITORY)
    private readonly planRepository: PlanRepository,
    @Inject(SUBSCRIPTION_REPOSITORY)
    private readonly subscriptionRepository: SubscriptionRepository,
    private readonly ensureTrialSubscription: EnsureTrialSubscriptionUseCase,
  ) {}

  async execute(): Promise<SeedResult> {
    if (this.runtimeEnvironment.isProduction()) {
      throw new ForbiddenError(ErrorCode.SEED_DISABLED);
    }

    await this.appointmentRepository.deleteAllUnscoped();
    await this.scheduleBlockRepository.deleteAllUnscoped();
    // Conversations hold a restricted reference to their client, so a database that has
    // already seen WhatsApp traffic refuses to drop the client book until they are gone.
    await this.conversationRepository.deleteAllUnscoped();
    await this.clientRepository.deleteAllUnscoped();
    await this.serviceWindowRepository.deleteAllUnscoped();
    await this.branchServiceRepository.deleteAllUnscoped();
    await this.branchProfessionalRepository.deleteAllUnscoped();
    await this.userBranchRepository.deleteAllUnscoped();
    await this.serviceRepository.deleteAllUnscoped();
    await this.depositQrRepository.deleteAllUnscoped();
    await this.professionalRepository.deleteAllUnscoped();
    await this.branchRepository.deleteAllUnscoped();
    await this.userRepository.deleteAllUnscoped();
    await this.businessConfigRepository.deleteAllUnscoped();
    await this.subscriptionRepository.deleteAllUnscoped();
    await this.tenantRepository.deleteAll();
    await this.planRepository.deleteAll();

    const plans = await this.seedPlans();
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
      await this.ensureTrialSubscription.execute(tenant.id);
      await this.assignPlan(
        tenant.id,
        fixture.planCode,
        fixture.subscriptionStatus,
      );

      await this.tenantContext.runWithTenant(tenant.id, async () => {
        await this.businessConfigRepository.create({
          slug: fixture.slug,
          agentName: fixture.agentName,
          tone: AgentTone.WARM,
          businessCategory: fixture.businessCategory,
          bookingPolicy: {
            minLeadTimeHours: 2,
            cancelRescheduleHours: 24,
            noShowMessage:
              'Si no podés asistir, avisanos con anticipación para liberar el horario.',
          },
          agentPolicy: DEFAULT_AGENT_POLICY,
          faq: fixture.faq,
        });

        const branchIds = new Map<string, string>();
        for (const branch of fixture.branches) {
          const created = await this.branchRepository.create({
            name: branch.name,
            slug: branch.slug,
            address: branch.address,
            phone: branch.phone ?? null,
            weeklyHours: branch.weeklyHours,
            isPrimary: branch.isPrimary ?? false,
            isActive: true,
          });
          branchIds.set(branch.key, created.id);
        }

        const owner = await this.userRepository.create({
          name: fixture.owner.name,
          email: fixture.owner.email,
          phone: fixture.owner.phone ?? null,
          password,
          role: Role.OWNER,
        });
        const staffUsers = [];
        for (const staff of fixture.staff) {
          staffUsers.push(
            await this.userRepository.create({
              name: staff.name,
              email: staff.email,
              phone: staff.phone ?? null,
              password,
              role: Role.STAFF,
            }),
          );
        }

        // Staff can open every seeded branch; owners do not need an explicit link.
        const allBranchIds = [...branchIds.values()];
        for (const staffUser of staffUsers) {
          await this.userBranchRepository.setForUser(
            staffUser.id,
            allBranchIds,
          );
        }
        void owner;

        const professionalIds = new Map<string, string>();
        for (const professional of fixture.professionals) {
          const created = await this.professionalRepository.create({
            name: professional.name,
            isActive: professional.isActive ?? true,
          });
          professionalIds.set(professional.key, created.id);
        }

        for (const branch of fixture.branches) {
          const branchId = branchIds.get(branch.key);
          if (!branchId) throw new Error(`Unknown branch key: ${branch.key}`);

          for (const professionalKey of branch.professionalKeys) {
            const professionalId = professionalIds.get(professionalKey);
            const hours = fixture.professionals.find(
              (item) => item.key === professionalKey,
            )?.weeklyHours;
            if (!professionalId || !hours) {
              throw new Error(`Unknown professional key: ${professionalKey}`);
            }
            await this.branchProfessionalRepository.upsert({
              branchId,
              professionalId,
              weeklyHours: hours,
            });
          }
        }

        const serviceIds = new Map<string, string>();
        const serviceMeta = new Map<
          string,
          {
            durationMinutes: number;
            price: string;
            depositAmount: string | null;
          }
        >();
        for (const service of fixture.services) {
          const created = await this.serviceRepository.create({
            name: service.name,
            durationMinutes: service.durationMinutes,
            currency: Currency.BOB,
            price: service.price,
            requiresDeposit: service.requiresDeposit ?? false,
            depositAmount: service.depositAmount ?? null,
            depositPercent: service.depositPercent ?? null,
            clientChoosesProfessional:
              service.clientChoosesProfessional ?? true,
            professionalIds: service.professionalKeys.map((key) => {
              const id = professionalIds.get(key);
              if (!id) throw new Error(`Unknown professional key: ${key}`);
              return id;
            }),
          });
          serviceIds.set(service.key, created.id);
          serviceMeta.set(service.key, {
            durationMinutes: service.durationMinutes,
            price: service.price,
            depositAmount: service.depositAmount ?? null,
          });
        }

        for (const branch of fixture.branches) {
          const branchId = branchIds.get(branch.key);
          if (!branchId) throw new Error(`Unknown branch key: ${branch.key}`);
          for (const offered of branch.services) {
            const serviceId = serviceIds.get(offered.key);
            if (!serviceId)
              throw new Error(`Unknown service key: ${offered.key}`);
            await this.branchServiceRepository.upsert({
              branchId,
              serviceId,
              priceOverrideAmount: offered.priceOverrideAmount ?? null,
            });
          }
        }

        const clientsByPhone = new Map<string, string>();
        for (const client of fixture.clients) {
          const created = await this.clientRepository.create(client);
          clientsByPhone.set(client.phoneE164, created.id);
        }

        for (const appointment of fixture.appointments) {
          const clientId = clientsByPhone.get(appointment.clientPhone);
          const professionalId = professionalIds.get(
            appointment.professionalKey,
          );
          const serviceId = serviceIds.get(appointment.serviceKey);
          const branchId = branchIds.get(appointment.branchKey);
          const meta = serviceMeta.get(appointment.serviceKey);
          if (
            !clientId ||
            !professionalId ||
            !serviceId ||
            !branchId ||
            !meta
          ) {
            throw new Error(
              `Incomplete appointment seed for ${appointment.clientPhone}`,
            );
          }

          const startsAt = atLocal(
            appointment.dayOffset,
            appointment.hour,
            appointment.minute ?? 0,
          );
          const offered = fixture.branches
            .find((branch) => branch.key === appointment.branchKey)
            ?.services.find((item) => item.key === appointment.serviceKey);
          const price = offered?.priceOverrideAmount ?? meta.price;

          await this.appointmentRepository.create({
            branchId,
            clientId,
            professionalId,
            serviceId,
            startsAt,
            endsAt: addMinutes(startsAt, meta.durationMinutes),
            status: appointment.status,
            price,
            currency: Currency.BOB,
            depositAmount: meta.depositAmount,
          });
        }

        for (const block of fixture.scheduleBlocks) {
          await this.scheduleBlockRepository.create({
            branchId: block.branchKey
              ? (branchIds.get(block.branchKey) ?? null)
              : null,
            professionalId: block.professionalKey
              ? (professionalIds.get(block.professionalKey) ?? null)
              : null,
            startsAt: atLocal(block.dayOffset, block.startHour),
            endsAt: atLocal(block.dayOffset, block.endHour),
            reason: block.reason,
          });
        }
      });

      tenants.push({
        id: tenant.id,
        name: tenant.name,
        owner: fixture.owner.email,
        staff: fixture.staff.map((item) => item.email),
        plan: fixture.planCode,
      });
    }

    return {
      tenants,
      plans: plans.map((plan) => plan.code),
      superadmin: superadmin.email,
    };
  }

  private async seedPlans() {
    const trial = await this.planRepository.create({
      code: TRIAL_PLAN_CODE,
      name: 'Prueba',
      isActive: true,
      price: Money.of('0.00', Currency.BOB),
      billingPeriodMonths: 1,
      config: {
        quotas: { aiRepliesPerPeriod: 200 },
        caps: {
          professionals: 3,
          services: 20,
          branches: 1,
          panelUsers: 3,
        },
        features: {
          multiBranch: false,
          webBookingPage: false,
          sessionPackages: false,
          reminders: false,
          reports: false,
        },
      },
    });

    const starter = await this.planRepository.create({
      code: 'starter',
      name: 'Starter',
      isActive: true,
      price: Money.of('350.00', Currency.BOB),
      billingPeriodMonths: 1,
      config: {
        quotas: { aiRepliesPerPeriod: 500 },
        caps: {
          professionals: 5,
          services: 30,
          branches: 2,
          panelUsers: 5,
        },
        features: {
          multiBranch: true,
          webBookingPage: false,
          sessionPackages: false,
          reminders: false,
          reports: false,
        },
      },
    });

    const pro = await this.planRepository.create({
      code: 'pro',
      name: 'Pro',
      isActive: true,
      price: Money.of('650.00', Currency.BOB),
      billingPeriodMonths: 1,
      config: {
        quotas: { aiRepliesPerPeriod: 2000 },
        caps: {
          professionals: 12,
          services: 80,
          branches: 5,
          panelUsers: 15,
        },
        features: {
          multiBranch: true,
          webBookingPage: true,
          sessionPackages: true,
          reminders: true,
          reports: true,
        },
      },
    });

    return [trial, starter, pro];
  }

  private async assignPlan(
    tenantId: string,
    planCode: string,
    status: SubscriptionStatus,
  ): Promise<void> {
    if (
      planCode === TRIAL_PLAN_CODE &&
      status === SubscriptionStatus.TRIALING
    ) {
      return;
    }

    const plan = await this.planRepository.findByCode(planCode);
    if (!plan) throw new Error(`Missing seeded plan: ${planCode}`);

    await this.tenantContext.runWithTenant(tenantId, async () => {
      const current = await this.subscriptionRepository.findCurrent();
      if (!current)
        throw new Error(`Missing trial subscription for ${tenantId}`);

      const now = new Date();
      await this.subscriptionRepository.update(current.id, {
        planId: plan.id,
        status,
        currentPeriodStart: now,
        currentPeriodEnd: addMonths(now, plan.billingPeriodMonths),
        price: plan.price,
        notes: `Seeded on ${planCode}`,
        cancelledAt: null,
      });
    });
  }
}
