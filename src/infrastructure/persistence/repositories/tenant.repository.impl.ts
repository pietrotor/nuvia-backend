import { Injectable } from '@nestjs/common';
import { eq } from 'drizzle-orm';

import {
  CreateTenantData,
  TenantRepository,
  UpdateTenantData,
} from '@domain/tenants/repositories/tenant.repository';
import { Tenant } from '@domain/tenants/entities/tenant.entity';
import { DEFAULT_SEND_WINDOW_CONFIG } from '@domain/tenants/value-objects/send-window-config.vo';
import { DrizzleService } from '../drizzle/drizzle.service';
import { tenants } from '../drizzle/schema';
import { TenantMapper } from '../drizzle/mappers/tenant.mapper';
import { DatabaseErrorTranslator } from '@infrastructure/errors/database-error.translator';

@Injectable()
export class DrizzleTenantRepository implements TenantRepository {
  constructor(private readonly drizzle: DrizzleService) {}

  async create(data: CreateTenantData): Promise<Tenant> {
    try {
      const [created] = await this.drizzle.db
        .insert(tenants)
        .values({
          name: data.name,
          vertical: data.vertical,
          timezone: data.timezone,
          whatsappPhone: data.whatsappPhone,
          plan: data.plan,
          sendWindowConfig: data.sendWindowConfig ?? DEFAULT_SEND_WINDOW_CONFIG,
        })
        .returning();

      return TenantMapper.toDomain(created);
    } catch (error) {
      throw DatabaseErrorTranslator.toDomain(error);
    }
  }

  async findById(id: string): Promise<Tenant | null> {
    const [row] = await this.drizzle.db
      .select()
      .from(tenants)
      .where(eq(tenants.id, id))
      .limit(1);

    return row ? TenantMapper.toDomain(row) : null;
  }

  async findAll(): Promise<Tenant[]> {
    const rows = await this.drizzle.db.select().from(tenants);

    return rows.map(TenantMapper.toDomain);
  }

  async update(id: string, data: UpdateTenantData): Promise<Tenant | null> {
    try {
      const [updated] = await this.drizzle.db
        .update(tenants)
        .set(data)
        .where(eq(tenants.id, id))
        .returning();

      return updated ? TenantMapper.toDomain(updated) : null;
    } catch (error) {
      throw DatabaseErrorTranslator.toDomain(error);
    }
  }

  async delete(id: string): Promise<void> {
    await this.drizzle.db.delete(tenants).where(eq(tenants.id, id));
  }

  async deleteAll(): Promise<void> {
    await this.drizzle.db.delete(tenants);
  }
}
