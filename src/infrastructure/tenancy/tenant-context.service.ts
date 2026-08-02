import { AsyncLocalStorage } from 'node:async_hooks';
import { Injectable } from '@nestjs/common';

import { TenantContextMissingError } from '@domain/common/exceptions';
import { Role } from '@domain/users/value-objects/role.vo';

export interface TenantContext {
  tenantId: string | null;
  userId: string | null;
  role: Role | null;
}

const emptyContext = (): TenantContext => ({
  tenantId: null,
  userId: null,
  role: null,
});

@Injectable()
export class TenantContextService {
  private readonly storage = new AsyncLocalStorage<TenantContext>();

  // Opens a mutable store for the whole request. The store is seeded empty by the
  // middleware and filled in by the JWT strategy once auth resolves, so anything
  // downstream (guards, use cases, repositories) sees the same object.
  run<T>(fn: () => T): T {
    return this.storage.run(emptyContext(), fn);
  }

  runWith<T>(context: TenantContext, fn: () => T): T {
    return this.storage.run({ ...context }, fn);
  }

  runWithTenant<T>(tenantId: string, fn: () => T): T {
    return this.runWith({ ...emptyContext(), tenantId }, fn);
  }

  set(context: Partial<TenantContext>): void {
    const store = this.storage.getStore();

    if (!store) {
      throw new TenantContextMissingError('set() called outside of run()');
    }

    Object.assign(store, context);
  }

  get(): TenantContext | undefined {
    return this.storage.getStore();
  }

  get tenantId(): string | null {
    return this.storage.getStore()?.tenantId ?? null;
  }

  get userId(): string | null {
    return this.storage.getStore()?.userId ?? null;
  }

  get role(): Role | null {
    return this.storage.getStore()?.role ?? null;
  }

  requireTenantId(caller: string): string {
    const tenantId = this.tenantId;

    if (!tenantId) {
      throw new TenantContextMissingError(caller);
    }

    return tenantId;
  }
}
