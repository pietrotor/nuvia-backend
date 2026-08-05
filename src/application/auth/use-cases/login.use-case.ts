import { Inject, Injectable } from '@nestjs/common';

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
  PASSWORD_HASHER_PORT,
  PasswordHasherPort,
} from '@domain/users/ports/password-hasher.port';
import {
  AuthTokenPayload,
  TOKEN_SIGNER_PORT,
  TokenSignerPort,
} from '@domain/auth/ports/token-signer.port';
import {
  TENANT_REPOSITORY,
  TenantRepository,
} from '@domain/tenants/repositories/tenant.repository';
import { TenantSuspendedError } from '@domain/tenants/exceptions/tenant.exceptions';
import { AuditAction } from '@domain/audit/entities/audit-log.entity';
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
    @Inject(PASSWORD_HASHER_PORT)
    private readonly passwordHasher: PasswordHasherPort,
    @Inject(TOKEN_SIGNER_PORT)
    private readonly tokenSigner: TokenSignerPort,
    private readonly audit: AuditRecorder,
  ) {}

  async execute(dto: LoginDto, ip?: string): Promise<LoginResult> {
    const email = dto.email.trim().toLowerCase();
    const user = await this.userRepository.findByEmailUnscoped(email);
    const passwordMatches =
      user !== null &&
      (await this.passwordHasher.compare(dto.password, user.password));

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

    const payload: AuthTokenPayload = {
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

    return { user: user.toPublic(), token: this.tokenSigner.sign(payload) };
  }
}
