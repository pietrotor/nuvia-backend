import { Injectable } from '@nestjs/common';
import { eq } from 'drizzle-orm';

import {
  ClientRepository,
  CreateClientData,
} from '@domain/clients/repositories/client.repository';
import { Client } from '@domain/clients/entities/client.entity';
import { ErrorCode, InternalError } from '@domain/common/exceptions';
import { TenantContextService } from '@infrastructure/tenancy/tenant-context.service';
import { DatabaseErrorTranslator } from '@infrastructure/errors/database-error.translator';

import { DrizzleService } from '../drizzle/drizzle.service';
import { clients } from '../drizzle/schema/client.schema';
import { ClientMapper } from '../drizzle/mappers/client.mapper';
import { TenantScopedRepository } from './tenant-scoped.repository';

@Injectable()
export class DrizzleClientRepository
  extends TenantScopedRepository
  implements ClientRepository
{
  constructor(drizzle: DrizzleService, tenantContext: TenantContextService) {
    super(drizzle, tenantContext);
  }

  async create(data: CreateClientData): Promise<Client> {
    try {
      const [created] = await this.insertInto(clients, {
        name: data.name,
        phoneE164: data.phoneE164,
        notes: data.notes,
      });
      return ClientMapper.toDomain(created);
    } catch (error) {
      throw DatabaseErrorTranslator.toDomain(error);
    }
  }

  async findById(id: string): Promise<Client | null> {
    const [row] = await this.selectFrom(clients, eq(clients.id, id));
    return row ? ClientMapper.toDomain(row) : null;
  }

  async findOrCreate(data: CreateClientData): Promise<Client> {
    const [created] = await this.drizzle.db
      .insert(clients)
      .values({ ...data, tenantId: this.tenantId })
      .onConflictDoNothing({
        target: [clients.tenantId, clients.phoneE164],
      })
      .returning();
    if (created) return ClientMapper.toDomain(created);

    const existing = await this.findByPhone(data.phoneE164);
    if (!existing) {
      throw new InternalError(ErrorCode.INTERNAL_ERROR);
    }
    return existing;
  }

  async findByPhone(phoneE164: string): Promise<Client | null> {
    const [row] = await this.selectFrom(
      clients,
      eq(clients.phoneE164, phoneE164),
    );
    return row ? ClientMapper.toDomain(row) : null;
  }

  async deleteAllUnscoped(): Promise<void> {
    await this.drizzle.db.delete(clients);
  }
}
