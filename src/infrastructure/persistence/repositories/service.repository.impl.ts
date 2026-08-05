import { Injectable } from '@nestjs/common';
import { and, eq, inArray } from 'drizzle-orm';

import {
  CreateServiceData,
  ServiceRepository,
  UpdateServiceData,
} from '@domain/services/repositories/service.repository';
import { Service } from '@domain/services/entities/service.entity';
import { TenantContextService } from '@infrastructure/tenancy/tenant-context.service';
import { DatabaseErrorTranslator } from '@infrastructure/errors/database-error.translator';

import { DrizzleService } from '../drizzle/drizzle.service';
import {
  professionalServices,
  services,
} from '../drizzle/schema/service.schema';
import { ServiceMapper } from '../drizzle/mappers/service.mapper';
import { TenantScopedRepository } from './tenant-scoped.repository';

@Injectable()
export class DrizzleServiceRepository
  extends TenantScopedRepository
  implements ServiceRepository
{
  constructor(drizzle: DrizzleService, tenantContext: TenantContextService) {
    super(drizzle, tenantContext);
  }

  async create(data: CreateServiceData): Promise<Service> {
    try {
      const tenantId = this.tenantId;
      return await this.drizzle.db.transaction(async (tx) => {
        const [created] = await tx
          .insert(services)
          .values({
            tenantId,
            name: data.name,
            durationMinutes: data.durationMinutes,
            currency: data.currency,
            price: data.price,
            requiresDeposit: data.requiresDeposit ?? false,
            depositAmount: data.depositAmount,
            depositPercent: data.depositPercent,
            isActive: data.isActive ?? true,
          })
          .returning();

        if (data.professionalIds.length > 0) {
          await tx.insert(professionalServices).values(
            data.professionalIds.map((professionalId) => ({
              tenantId,
              professionalId,
              serviceId: created.id,
            })),
          );
        }

        return ServiceMapper.toDomain(created, data.professionalIds);
      });
    } catch (error) {
      throw DatabaseErrorTranslator.toDomain(error);
    }
  }

  async findById(id: string): Promise<Service | null> {
    const [row] = await this.selectFrom(services, eq(services.id, id));
    if (!row) return null;
    const professionalIds = await this.professionalIdsFor([id]);
    return ServiceMapper.toDomain(row, professionalIds.get(id) ?? []);
  }

  async findAll(): Promise<Service[]> {
    const rows = await this.selectFrom(services);
    const map = await this.professionalIdsFor(rows.map((r) => r.id));
    return rows.map((row) =>
      ServiceMapper.toDomain(row, map.get(row.id) ?? []),
    );
  }

  async update(id: string, data: UpdateServiceData): Promise<Service | null> {
    try {
      const tenantId = this.tenantId;
      return await this.drizzle.db.transaction(async (tx) => {
        const { professionalIds, ...serviceData } = data;
        const [updated] = await tx
          .update(services)
          .set(serviceData)
          .where(and(eq(services.tenantId, tenantId), eq(services.id, id)))
          .returning();

        if (!updated) return null;

        let assignedProfessionalIds = professionalIds;
        if (professionalIds !== undefined) {
          await tx
            .delete(professionalServices)
            .where(
              and(
                eq(professionalServices.tenantId, tenantId),
                eq(professionalServices.serviceId, id),
              ),
            );

          if (professionalIds.length > 0) {
            await tx.insert(professionalServices).values(
              professionalIds.map((professionalId) => ({
                tenantId,
                professionalId,
                serviceId: id,
              })),
            );
          }
        } else {
          const rows = await tx
            .select({ professionalId: professionalServices.professionalId })
            .from(professionalServices)
            .where(
              and(
                eq(professionalServices.tenantId, tenantId),
                eq(professionalServices.serviceId, id),
              ),
            );
          assignedProfessionalIds = rows.map((row) => row.professionalId);
        }

        return ServiceMapper.toDomain(updated, assignedProfessionalIds ?? []);
      });
    } catch (error) {
      throw DatabaseErrorTranslator.toDomain(error);
    }
  }

  async deleteAllUnscoped(): Promise<void> {
    await this.drizzle.db.delete(professionalServices);
    await this.drizzle.db.delete(services);
  }

  private async professionalIdsFor(
    serviceIds: string[],
  ): Promise<Map<string, string[]>> {
    const result = new Map<string, string[]>();
    if (serviceIds.length === 0) return result;

    const rows = await this.drizzle.db
      .select()
      .from(professionalServices)
      .where(
        and(
          eq(professionalServices.tenantId, this.tenantId),
          inArray(professionalServices.serviceId, serviceIds),
        ),
      );

    for (const row of rows) {
      const list = result.get(row.serviceId) ?? [];
      list.push(row.professionalId);
      result.set(row.serviceId, list);
    }
    return result;
  }
}
