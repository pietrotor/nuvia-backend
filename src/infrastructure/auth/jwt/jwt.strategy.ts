import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';

import {
  USER_REPOSITORY,
  UserRepository,
} from '@domain/users/repositories/user.repository';
import { User } from '@domain/users/entities/user.entity';
import {
  InvalidCredentialsError,
  SessionTenantMismatchError,
  UserInactiveError,
} from '@domain/users/exceptions/user.exceptions';
import {
  TENANT_REPOSITORY,
  TenantRepository,
} from '@domain/tenants/repositories/tenant.repository';
import { TenantSuspendedError } from '@domain/tenants/exceptions/tenant.exceptions';
import { AuthTokenPayload } from '@domain/auth/ports/token-signer.port';
import { TenantContextService } from '@infrastructure/tenancy/tenant-context.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    @Inject(USER_REPOSITORY)
    private readonly userRepository: UserRepository,
    @Inject(TENANT_REPOSITORY)
    private readonly tenantRepository: TenantRepository,
    private readonly tenantContext: TenantContextService,
    configService: ConfigService,
  ) {
    super({
      secretOrKey: configService.getOrThrow<string>('JWT_SECRET'),
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
    });
  }

  async validate(payload: AuthTokenPayload): Promise<User> {
    const user = await this.userRepository.findByIdUnscoped(payload.sub);

    if (!user) {
      throw new InvalidCredentialsError();
    }

    if (!user.isActive) {
      throw new UserInactiveError();
    }

    // A token minted before a role or tenant change must not keep the old claims.
    if (payload.tenantId !== user.tenantId || payload.role !== user.role) {
      throw new SessionTenantMismatchError();
    }

    if (user.tenantId) {
      const tenant = await this.tenantRepository.findById(user.tenantId);

      if (!tenant) {
        throw new SessionTenantMismatchError();
      }

      if (!tenant.canOperate()) {
        throw new TenantSuspendedError(tenant.name);
      }
    }

    // Single point where the request gets its tenant: no authenticated route can
    // run without context.
    this.tenantContext.set({
      tenantId: user.tenantId,
      userId: user.id,
      role: user.role,
    });

    return user;
  }
}
