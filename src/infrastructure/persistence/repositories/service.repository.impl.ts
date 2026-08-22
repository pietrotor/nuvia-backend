import { Injectable } from '@nestjs/common';
import { and, eq, inArray } from 'drizzle-orm';

import {
  CreateServiceData,
  ServiceBookingQuestionInput,
  ServiceRepository,
  UpdateServiceData,
} from '@domain/services/repositories/service.repository';
import { Service } from '@domain/services/entities/service.entity';
import { TenantContextService } from '@infrastructure/tenancy/tenant-context.service';
import { DatabaseErrorTranslator } from '@infrastructure/errors/database-error.translator';

import { DrizzleService } from '../drizzle/drizzle.service';
import {
  professionalServices,
  serviceBookingQuestions,
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
            description: data.description ?? null,
            keywords: data.keywords ?? [],
            durationMinutes: data.durationMinutes,
            currency: data.currency,
            price: data.price,
            requiresDeposit: data.requiresDeposit ?? false,
            depositAmount: data.depositAmount,
            depositPercent: data.depositPercent,
            depositQrId: data.depositQrId,
            clientChoosesProfessional: data.clientChoosesProfessional ?? true,
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

        const questions = await this.replaceQuestions(
          tx,
          tenantId,
          created.id,
          data.bookingQuestions ?? [],
        );

        return ServiceMapper.toDomain(created, data.professionalIds, questions);
      });
    } catch (error) {
      throw DatabaseErrorTranslator.toDomain(error);
    }
  }

  async findById(id: string): Promise<Service | null> {
    const [row] = await this.selectFrom(services, eq(services.id, id));
    if (!row) return null;
    const professionalIds = await this.professionalIdsFor([id]);
    const questions = await this.questionsFor([id]);
    return ServiceMapper.toDomain(
      row,
      professionalIds.get(id) ?? [],
      questions.get(id) ?? [],
    );
  }

  async findAll(): Promise<Service[]> {
    const rows = await this.selectFrom(services);
    const map = await this.professionalIdsFor(rows.map((r) => r.id));
    const questions = await this.questionsFor(rows.map((r) => r.id));
    return rows.map((row) =>
      ServiceMapper.toDomain(
        row,
        map.get(row.id) ?? [],
        questions.get(row.id) ?? [],
      ),
    );
  }

  async update(id: string, data: UpdateServiceData): Promise<Service | null> {
    try {
      const tenantId = this.tenantId;
      return await this.drizzle.db.transaction(async (tx) => {
        const { professionalIds, bookingQuestions, ...serviceData } = data;
        const scope = and(eq(services.tenantId, tenantId), eq(services.id, id));

        /* A patch that only moves who offers the service leaves the row untouched, and
         * asking the driver to set no column at all is an error, not a no-op. */
        const [updated] =
          Object.keys(serviceData).length > 0
            ? await tx
                .update(services)
                .set(serviceData)
                .where(scope)
                .returning()
            : await tx.select().from(services).where(scope);

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

        const questions =
          bookingQuestions !== undefined
            ? await this.replaceQuestions(tx, tenantId, id, bookingQuestions)
            : ((await this.questionsFor([id], tx)).get(id) ?? []);

        return ServiceMapper.toDomain(
          updated,
          assignedProfessionalIds ?? [],
          questions,
        );
      });
    } catch (error) {
      throw DatabaseErrorTranslator.toDomain(error);
    }
  }

  async deleteAllUnscoped(): Promise<void> {
    await this.drizzle.db.delete(serviceBookingQuestions);
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

  private async questionsFor(
    serviceIds: string[],
    db: Pick<DrizzleService['db'], 'select'> = this.drizzle.db,
  ) {
    const result = new Map<
      string,
      (typeof serviceBookingQuestions.$inferSelect)[]
    >();
    if (serviceIds.length === 0) return result;

    const rows = await db
      .select()
      .from(serviceBookingQuestions)
      .where(
        and(
          eq(serviceBookingQuestions.tenantId, this.tenantId),
          inArray(serviceBookingQuestions.serviceId, serviceIds),
        ),
      );

    for (const row of rows) {
      const list = result.get(row.serviceId) ?? [];
      list.push(row);
      result.set(row.serviceId, list);
    }
    return result;
  }

  private async replaceQuestions(
    db: Pick<DrizzleService['db'], 'select' | 'insert' | 'update'>,
    tenantId: string,
    serviceId: string,
    incoming: ServiceBookingQuestionInput[],
  ) {
    const existing =
      (await this.questionsFor([serviceId], db)).get(serviceId) ?? [];
    const keptIds = new Set(
      incoming
        .map((question) => question.id)
        .filter((id): id is string => !!id),
    );

    for (const row of existing) {
      if (!keptIds.has(row.id) && row.isActive) {
        await db
          .update(serviceBookingQuestions)
          .set({ isActive: false })
          .where(
            and(
              eq(serviceBookingQuestions.tenantId, tenantId),
              eq(serviceBookingQuestions.id, row.id),
            ),
          );
      }
    }

    for (const question of incoming) {
      const current = question.id
        ? existing.find((row) => row.id === question.id)
        : undefined;
      if (current) {
        await db
          .update(serviceBookingQuestions)
          .set({
            prompt: question.prompt,
            kind: question.kind,
            isRequired: question.isRequired,
            sortOrder: question.sortOrder,
            isActive: question.isActive ?? true,
          })
          .where(
            and(
              eq(serviceBookingQuestions.tenantId, tenantId),
              eq(serviceBookingQuestions.id, current.id),
            ),
          );
      } else {
        await db.insert(serviceBookingQuestions).values({
          tenantId,
          serviceId,
          prompt: question.prompt,
          kind: question.kind,
          isRequired: question.isRequired,
          sortOrder: question.sortOrder,
          isActive: question.isActive ?? true,
        });
      }
    }

    return (await this.questionsFor([serviceId], db)).get(serviceId) ?? [];
  }
}
