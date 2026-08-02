import { Inject, Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';

import {
  USER_REPOSITORY,
  UserRepository,
} from '@domain/users/repositories/user.repository';
import { PublicUser } from '@domain/users/entities/user.entity';
import {
  InvalidCredentialsError,
  UserInactiveError,
} from '@domain/users/exceptions/user.exceptions';
import {
  TENANT_REPOSITORY,
  TenantRepository,
} from '@domain/tenants/repositories/tenant.repository';
import { TenantSuspendedError } from '@domain/tenants/exceptions/tenant.exceptions';
import { AuditAction } from '@domain/audit/entities/audit-log.entity';
import { BcryptService } from '@infrastructure/auth/bcrypt/bcrypt.service';
import { JwtPayload } from '@infrastructure/auth/jwt/jwt-payload.interface';
import { AuditRecorder } from '@application/audit/services/audit-recorder.service';
import { LoginDto } from '../dto/login.dto';

export interface LoginResult {
  user: PublicUser;
  token: string;
}

@Injectable()
export class LoginUseCase {
  constructor(
    @Inject(USER_REPOSITORY)
    private readonly userRepository: UserRepository,
    @Inject(TENANT_REPOSITORY)
    private readonly tenantRepository: TenantRepository,
    private readonly bcrypt: BcryptService,
    private readonly jwt: JwtService,
    private readonly audit: AuditRecorder,
  ) {}

  async execute(dto: LoginDto, ip?: string): Promise<LoginResult> {
    const email = dto.email.trim().toLowerCase();
    const user = await this.userRepository.findByEmailUnscoped(email);
    const passwordMatches =
      user !== null && (await this.bcrypt.compare(dto.password, user.password));

    if (!passwordMatches) {
      await this.audit.record({
        action: AuditAction.LOGIN_FAILED,
        entity: 'user',
        entityId: user?.id ?? email,
        tenantId: user?.tenantId ?? null,
        userId: user?.id ?? null,
        ip,
      });

      throw new InvalidCredentialsError();
    }

    if (!user.isActive) {
      throw new UserInactiveError();
    }

    if (user.tenantId) {
      const tenant = await this.tenantRepository.findById(user.tenantId);

      if (!tenant?.canOperate()) {
        throw new TenantSuspendedError(tenant?.name ?? '');
      }
    }

    const payload: JwtPayload = {
      sub: user.id,
      tenantId: user.tenantId,
      role: user.role,
    };

    await this.audit.record({
      action: AuditAction.LOGIN,
      entity: 'user',
      entityId: user.id,
      tenantId: user.tenantId,
      userId: user.id,
      ip,
    });

    return { user: user.toPublic(), token: this.jwt.sign(payload) };
  }
}
