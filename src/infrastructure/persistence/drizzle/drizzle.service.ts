import { AsyncLocalStorage } from 'node:async_hooks';

import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { drizzle, NodePgDatabase } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from './schema';

type AppDatabase = NodePgDatabase<typeof schema>;

@Injectable()
export class DrizzleService implements OnModuleInit, OnModuleDestroy {
  private pool: Pool;
  private root: AppDatabase;
  private readonly transactions = new AsyncLocalStorage<AppDatabase>();

  constructor(private configService: ConfigService) {}

  get db(): AppDatabase {
    return this.transactions.getStore() ?? this.root;
  }

  async runInTransaction<T>(fn: () => Promise<T>): Promise<T> {
    if (this.transactions.getStore()) return fn();
    return this.root.transaction((tx) => this.transactions.run(tx, fn));
  }

  async onModuleInit() {
    this.pool = new Pool({
      host: this.configService.get('DB_HOST'),
      port: this.configService.get('DB_PORT'),
      user: this.configService.get('DB_USERNAME'),
      password: this.configService.get('DB_PASSWORD'),
      database: this.configService.get('DB_NAME'),
    });

    this.root = drizzle(this.pool, { schema });
  }

  async onModuleDestroy() {
    await this.pool.end();
  }
}
