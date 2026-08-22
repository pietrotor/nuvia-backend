import { Inject, Injectable } from '@nestjs/common';

import {
  TENANT_REPOSITORY,
  TenantRepository,
} from '@domain/tenants/repositories/tenant.repository';
import { Tenant } from '@domain/tenants/entities/tenant.entity';
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
  BRANCH_REPOSITORY,
  BranchRepository,
} from '@domain/branches/repositories/branch.repository';
import {
  USER_REPOSITORY,
  UserRepository,
} from '@domain/users/repositories/user.repository';
import { PublicUser } from '@domain/users/entities/user.entity';
import { Role } from '@domain/users/value-objects/role.vo';
import { EmailAlreadyRegisteredError } from '@domain/users/exceptions/user.exceptions';
import {
  PASSWORD_HASHER_PORT,
  PasswordHasherPort,
} from '@domain/users/ports/password-hasher.port';
import { PhoneNumberService } from '@application/common/services/phone-number.service';
import {
  TENANT_CONTEXT_PORT,
  TenantContextPort,
} from '@domain/tenants/ports/tenant-context.port';
import { AuditAction } from '@domain/audit/entities/audit-log.entity';
import { AuditRecorder } from '@application/audit/services/audit-recorder.service';
import { EnsureTrialSubscriptionUseCase } from '@application/subscriptions/use-cases/ensure-trial-subscription.use-case';
import { CreateTenantDto } from '../dto/create-tenant.dto';

const DEFAULT_HOURS: WeeklyHours = {
  mon: { start: '09:00', end: '18:00' },
  tue: { start: '09:00', end: '18:00' },
  wed: { start: '09:00', end: '18:00' },
  thu: { start: '09:00', end: '18:00' },
  fri: { start: '09:00', end: '18:00' },
  sat: { start: '09:00', end: '13:00' },
  sun: null,
};

const PRIMARY_BRANCH_NAME = 'Casa Matriz';
const PRIMARY_BRANCH_SLUG = 'casa-matriz';

export interface CreateTenantResult {
  tenant: Tenant;
  owner: PublicUser;
}

@Injectable()
export class CreateTenantUseCase {
  constructor(
    @Inject(TENANT_REPOSITORY)
    private readonly tenantRepository: TenantRepository,
    @Inject(BUSINESS_CONFIG_REPOSITORY)
    private readonly businessConfigRepository: BusinessConfigRepository,
    @Inject(BRANCH_REPOSITORY)
    private readonly branchRepository: BranchRepository,
    @Inject(USER_REPOSITORY)
    private readonly userRepository: UserRepository,
    @Inject(PASSWORD_HASHER_PORT)
    private readonly passwordHasher: PasswordHasherPort,
    @Inject(TENANT_CONTEXT_PORT)
    private readonly tenantContext: TenantContextPort,
    private readonly audit: AuditRecorder,
    private readonly ensureTrialSubscription: EnsureTrialSubscriptionUseCase,
    private readonly phoneNumbers: PhoneNumberService,
  ) {}

  async execute(dto: CreateTenantDto): Promise<CreateTenantResult> {
    const email = dto.owner.email.trim().toLowerCase();

    if (await this.userRepository.findByEmailUnscoped(email)) {
      throw new EmailAlreadyRegisteredError(email);
    }

    const passwordHash = await this.passwordHasher.hash(dto.owner.password);
    const slug =
      dto.slug?.trim() ??
      dto.name
        .trim()
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '');

    const tenant = await this.tenantRepository.create({
      name: dto.name.trim(),
      timezone: dto.timezone,
    });

    const owner = await this.tenantContext.runWithTenant(
      tenant.id,
      async () => {
        await this.businessConfigRepository.create({
          slug,
          agentName: 'Vale',
          tone: AgentTone.WARM,
          businessCategory: dto.businessCategory,
          countryCode: dto.countryCode ?? 'BO',
          bookingPolicy: {
            minLeadTimeHours: 2,
            cancelRescheduleHours: 24,
            noShowMessage:
              'Si no podés asistir, avisanos con anticipación para liberar el horario.',
          },
          agentPolicy: DEFAULT_AGENT_POLICY,
          faq: {},
        });

        await this.branchRepository.create({
          name: PRIMARY_BRANCH_NAME,
          slug: PRIMARY_BRANCH_SLUG,
          address: null,
          weeklyHours: DEFAULT_HOURS,
          isPrimary: true,
          isActive: true,
        });

        return this.userRepository.create({
          name: dto.owner.name.trim(),
          email,
          password: passwordHash,
          role: Role.OWNER,
          phone:
            dto.owner.phone == null
              ? null
              : this.phoneNumbers.normalizeToE164(
                  dto.owner.phone,
                  dto.countryCode ?? 'BO',
                ),
        });
      },
    );

    await this.ensureTrialSubscription.execute(tenant.id);

    await this.audit.record({
      action: AuditAction.TENANT_CREATED,
      entity: 'tenant',
      entityId: tenant.id,
      tenantId: tenant.id,
      after: { name: tenant.name, slug, owner: email },
    });

    return { tenant, owner: owner.toPublic() };
  }
}
