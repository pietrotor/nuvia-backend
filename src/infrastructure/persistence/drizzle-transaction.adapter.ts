import { Injectable } from '@nestjs/common';

import { TransactionPort } from '@domain/common/ports/transaction.port';
import { DrizzleService } from './drizzle/drizzle.service';

@Injectable()
export class DrizzleTransactionAdapter implements TransactionPort {
  constructor(private readonly drizzle: DrizzleService) {}

  run<T>(fn: () => Promise<T>): Promise<T> {
    return this.drizzle.runInTransaction(fn);
  }
}
