import { Injectable, NestMiddleware } from '@nestjs/common';
import { NextFunction, Request, Response } from 'express';

import { TenantContextService } from './tenant-context.service';

// Must run as middleware, not as an interceptor: middleware wraps the guards and
// the handler in the same async scope, so the context set during authentication
// is still visible when repositories run.
@Injectable()
export class TenantContextMiddleware implements NestMiddleware {
  constructor(private readonly tenantContext: TenantContextService) {}

  use(_req: Request, _res: Response, next: NextFunction): void {
    this.tenantContext.run(() => next());
  }
}
