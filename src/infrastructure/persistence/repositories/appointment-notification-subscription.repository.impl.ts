import { Injectable } from '@nestjs/common';
import { and, eq, inArray, isNull, type SQL } from 'drizzle-orm';

import { AppointmentNotificationSubscription } from '@domain/appointment-notifications/entities/appointment-notification-subscription.entity';
import {
  AppointmentNotificationSubscriptionRepository,
  CreateNotificationSubscriptionData,
} from '@domain/appointment-notifications/repositories/appointment-notification-subscription.repository';
import { TenantContextService } from '@infrastructure/tenancy/tenant-context.service';
import { DatabaseErrorTranslator } from '@infrastructure/errors/database-error.translator';

import { DrizzleService } from '../drizzle/drizzle.service';
import { AppointmentNotificationSubscriptionMapper } from '../drizzle/mappers/appointment-notification-subscription.mapper';
import { appointmentNotificationSubscriptions } from '../drizzle/schema/appointment-notification.schema';
import { TenantScopedRepository } from './tenant-scoped.repository';

@Injectable()
export class DrizzleAppointmentNotificationSubscriptionRepository
  extends TenantScopedRepository
  implements AppointmentNotificationSubscriptionRepository
{
  constructor(drizzle: DrizzleService, tenantContext: TenantContextService) {
    super(drizzle, tenantContext);
  }

  async create(
    data: CreateNotificationSubscriptionData,
  ): Promise<AppointmentNotificationSubscription> {
    try {
      const [row] = await this.insertInto(
        appointmentNotificationSubscriptions,
        {
          contactId: data.contactId,
          professionalId: data.professionalId ?? null,
          branchId: data.branchId ?? null,
          enabledAt: data.enabledAt,
          disabledAt: null,
        },
      );
      return AppointmentNotificationSubscriptionMapper.toDomain(row);
    } catch (error) {
      throw DatabaseErrorTranslator.toDomain(error);
    }
  }

  async save(
    subscription: AppointmentNotificationSubscription,
  ): Promise<AppointmentNotificationSubscription> {
    const [row] = await this.updateIn(
      appointmentNotificationSubscriptions,
      {
        enabledAt: subscription.enabledAt,
        disabledAt: subscription.disabledAt,
      },
      eq(appointmentNotificationSubscriptions.id, subscription.id),
    );
    return AppointmentNotificationSubscriptionMapper.toDomain(row);
  }

  async findById(
    id: string,
  ): Promise<AppointmentNotificationSubscription | null> {
    const [row] = await this.selectFrom(
      appointmentNotificationSubscriptions,
      eq(appointmentNotificationSubscriptions.id, id),
    );
    return row ? AppointmentNotificationSubscriptionMapper.toDomain(row) : null;
  }

  async findEnabledByProfessional(
    professionalId: string,
  ): Promise<AppointmentNotificationSubscription[]> {
    return this.findEnabled(
      eq(appointmentNotificationSubscriptions.professionalId, professionalId),
    );
  }

  async findEnabledByBranch(
    branchId: string,
  ): Promise<AppointmentNotificationSubscription[]> {
    return this.findEnabled(
      eq(appointmentNotificationSubscriptions.branchId, branchId),
    );
  }

  async findEnabledByProfessionals(
    professionalIds: string[],
  ): Promise<AppointmentNotificationSubscription[]> {
    if (professionalIds.length === 0) return [];
    return this.findEnabled(
      inArray(
        appointmentNotificationSubscriptions.professionalId,
        professionalIds,
      ),
    );
  }

  async findEnabledByBranches(
    branchIds: string[],
  ): Promise<AppointmentNotificationSubscription[]> {
    if (branchIds.length === 0) return [];
    return this.findEnabled(
      inArray(appointmentNotificationSubscriptions.branchId, branchIds),
    );
  }

  async countEnabledByBranch(branchId: string): Promise<number> {
    const rows = await this.findEnabledByBranch(branchId);
    return rows.length;
  }

  private async findEnabled(condition: SQL | undefined) {
    const rows = await this.selectFrom(
      appointmentNotificationSubscriptions,
      and(condition, isNull(appointmentNotificationSubscriptions.disabledAt)),
    );
    return rows.map(AppointmentNotificationSubscriptionMapper.toDomain);
  }
}
