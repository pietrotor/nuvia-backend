import { Inject, Injectable } from '@nestjs/common';

import {
  TENANT_REPOSITORY,
  TenantRepository,
} from '@domain/tenants/repositories/tenant.repository';
import { Tenant } from '@domain/tenants/entities/tenant.entity';
import {
  USER_REPOSITORY,
  UserRepository,
} from '@domain/users/repositories/user.repository';
import { PublicUser } from '@domain/users/entities/user.entity';
import { Role } from '@domain/users/value-objects/role.vo';
import { EmailAlreadyRegisteredError } from '@domain/users/exceptions/user.exceptions';
import { AuditAction } from '@domain/audit/entities/audit-log.entity';
import { BcryptService } from '@infrastructure/auth/bcrypt/bcrypt.service';
import { TenantContextService } from '@infrastructure/tenancy/tenant-context.service';
import { AuditRecorder } from '@application/audit/services/audit-recorder.service';
import { CreateTenantDto } from '../dto/create-tenant.dto';

export interface CreateTenantResult {
  tenant: Tenant;
  owner: PublicUser;
}

@Injectable()
export class CreateTenantUseCase {
  constructor(
    @Inject(TENANT_REPOSITORY)
    private readonly tenantRepository: TenantRepository,
    @Inject(USER_REPOSITORY)
    private readonly userRepository: UserRepository,
    private readonly bcrypt: BcryptService,
    private readonly tenantContext: TenantContextService,
    private readonly audit: AuditRecorder,
  ) {}

  async execute(dto: CreateTenantDto): Promise<CreateTenantResult> {
    const email = dto.owner.email.trim().toLowerCase();

    if (await this.userRepository.findByEmailUnscoped(email)) {
      throw new EmailAlreadyRegisteredError(email);
    }

    const passwordHash = await this.bcrypt.hash(dto.owner.password);

    const tenant = await this.tenantRepository.create({
      name: dto.name.trim(),
      vertical: dto.vertical,
      timezone: dto.timezone,
      plan: dto.plan,
    });

    // The caller is a superadmin with no tenant in context, so the owner is created
    // inside the new tenant's scope instead of passing the id to the repository.
    const owner = await this.tenantContext.runWithTenant(tenant.id, () =>
      this.userRepository.create({
        name: dto.owner.name.trim(),
        email,
        password: passwordHash,
        role: Role.OWNER,
        phone: dto.owner.phone ?? null,
      }),
    );

    await this.audit.record({
      action: AuditAction.TENANT_CREATED,
      entity: 'tenant',
      entityId: tenant.id,
      tenantId: tenant.id,
      after: { name: tenant.name, vertical: tenant.vertical, owner: email },
    });

    return { tenant, owner: owner.toPublic() };
  }
}
