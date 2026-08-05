import { Injectable } from '@nestjs/common';
import { SQL, eq, gte, inArray, lt } from 'drizzle-orm';

import { AppointmentStatus } from '@domain/appointments/entities/appointment.entity';
import {
  AppointmentView,
  AppointmentViewRepository,
} from '@domain/appointments/repositories/appointment-view.repository';
import { Currency } from '@domain/common/value-objects/currency.vo';
import { Money } from '@domain/common/value-objects/money.vo';
import { TenantContextService } from '@infrastructure/tenancy/tenant-context.service';

import { DrizzleService } from '../drizzle/drizzle.service';
import { appointments } from '../drizzle/schema/appointment.schema';
import { clients } from '../drizzle/schema/client.schema';
import { professionals } from '../drizzle/schema/professional.schema';
import { services } from '../drizzle/schema/service.schema';
import { AppointmentMapper } from '../drizzle/mappers/appointment.mapper';
import { TenantScopedRepository } from './tenant-scoped.repository';

@Injectable()
export class DrizzleAppointmentViewRepository
  extends TenantScopedRepository
  implements AppointmentViewRepository
{
  constructor(drizzle: DrizzleService, tenantContext: TenantContextService) {
    super(drizzle, tenantContext);
  }

  async findInRange(input: {
    from: Date;
    toExclusive: Date;
    professionalId?: string;
  }): Promise<AppointmentView[]> {
    return this.findWhere(
      gte(appointments.startsAt, input.from),
      lt(appointments.startsAt, input.toExclusive),
      input.professionalId
        ? eq(appointments.professionalId, input.professionalId)
        : undefined,
    );
  }

  async findByClient(input: {
    clientId: string;
    statuses?: AppointmentStatus[];
    from?: Date;
  }): Promise<AppointmentView[]> {
    return this.findWhere(
      eq(appointments.clientId, input.clientId),
      input.statuses?.length
        ? inArray(appointments.status, input.statuses)
        : undefined,
      input.from ? gte(appointments.startsAt, input.from) : undefined,
    );
  }

  // A single query with the joins: both the panel and the agent need the names, and
  // resolving them appointment by appointment would be N+1. The three FKs are notNull,
  // so the inner join cannot lose rows. Individual columns are selected on purpose: the
  // professional's weeklyHours has no reason to travel with every appointment.
  private async findWhere(
    ...conditions: (SQL | undefined)[]
  ): Promise<AppointmentView[]> {
    const rows = await this.drizzle.db
      .select({
        appointment: appointments,
        client: {
          id: clients.id,
          name: clients.name,
          phoneE164: clients.phoneE164,
        },
        professional: {
          id: professionals.id,
          name: professionals.name,
        },
        service: {
          id: services.id,
          name: services.name,
          durationMinutes: services.durationMinutes,
          currency: services.currency,
          price: services.price,
          requiresDeposit: services.requiresDeposit,
        },
      })
      .from(appointments)
      .innerJoin(clients, eq(clients.id, appointments.clientId))
      .innerJoin(
        professionals,
        eq(professionals.id, appointments.professionalId),
      )
      .innerJoin(services, eq(services.id, appointments.serviceId))
      .where(this.scope(appointments, ...conditions))
      .orderBy(appointments.startsAt);

    return rows.map((row) => ({
      appointment: AppointmentMapper.toDomain(row.appointment),
      client: row.client,
      professional: row.professional,
      service: {
        id: row.service.id,
        name: row.service.name,
        durationMinutes: row.service.durationMinutes,
        price: Money.of(row.service.price, row.service.currency as Currency),
        requiresDeposit: row.service.requiresDeposit,
      },
    }));
  }
}
