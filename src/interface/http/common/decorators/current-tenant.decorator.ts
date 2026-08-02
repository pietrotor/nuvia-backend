import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { Request } from 'express';

import { User } from '@domain/users/entities/user.entity';
import { TenantContextMissingError } from '@domain/common/exceptions';

// Injects the tenant of the authenticated user. Never read the tenant from a
// route param or from the body: that would let a client point at another tenant.
export const CurrentTenant = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): string => {
    const request = ctx.switchToHttp().getRequest<Request>();
    const user = request.user as User | undefined;

    if (!user?.tenantId) {
      throw new TenantContextMissingError(
        '@CurrentTenant() on a route without tenant',
      );
    }

    return user.tenantId;
  },
);
