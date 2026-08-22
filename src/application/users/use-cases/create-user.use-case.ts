import { Inject, Injectable } from '@nestjs/common';

import {
  USER_REPOSITORY,
  UserRepository,
} from '@domain/users/repositories/user.repository';
import { PublicUser } from '@domain/users/entities/user.entity';
import { Role } from '@domain/users/value-objects/role.vo';
import {
  EmailAlreadyRegisteredError,
  SuperadminCannotBelongToTenantError,
} from '@domain/users/exceptions/user.exceptions';
import {
  PASSWORD_HASHER_PORT,
  PasswordHasherPort,
} from '@domain/users/ports/password-hasher.port';
import { AuditAction } from '@domain/audit/entities/audit-log.entity';
import { AuditRecorder } from '@application/audit/services/audit-recorder.service';
import { PhoneNumberService } from '@application/common/services/phone-number.service';
import { TenantCountryService } from '@application/common/services/tenant-country.service';
import { PlanEntitlements } from '@application/subscriptions/services/plan-entitlements.service';
import { PlanCap } from '@domain/subscriptions/value-objects/plan-config.vo';
import { CreateUserDto } from '../dto/create-user.dto';

@Injectable()
export class CreateUserUseCase {
  constructor(
    @Inject(USER_REPOSITORY)
    private readonly userRepository: UserRepository,
    @Inject(PASSWORD_HASHER_PORT)
    private readonly passwordHasher: PasswordHasherPort,
    private readonly audit: AuditRecorder,
    private readonly entitlements: PlanEntitlements,
    private readonly phoneNumbers: PhoneNumberService,
    private readonly tenantCountry: TenantCountryService,
  ) {}

  async execute(dto: CreateUserDto): Promise<PublicUser> {
    if (dto.role === Role.SUPERADMIN) {
      throw new SuperadminCannotBelongToTenantError();
    }

    await this.entitlements.assertWithinCap(PlanCap.PANEL_USERS);

    const email = dto.email.trim().toLowerCase();

    // Email is unique across the whole platform, so the check cannot be scoped.
    if (await this.userRepository.findByEmailUnscoped(email)) {
      throw new EmailAlreadyRegisteredError(email);
    }

    const country = await this.tenantCountry.getCurrentCountryCode();
    const phone =
      dto.phone === undefined || dto.phone === null
        ? null
        : this.phoneNumbers.normalizeToE164(dto.phone, country);

    const created = await this.userRepository.create({
      name: dto.name.trim(),
      email,
      password: await this.passwordHasher.hash(dto.password),
      role: dto.role,
      phone,
    });

    await this.audit.record({
      action: AuditAction.USER_CREATED,
      entity: 'user',
      entityId: created.id,
      after: { email: created.email, role: created.role },
    });

    return created.toPublic();
  }
}
