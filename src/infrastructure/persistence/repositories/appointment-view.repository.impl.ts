import { Injectable } from '@nestjs/common';
import { SQL, and, eq, gte, inArray, lt, ne, or } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';

import { AppointmentStatus } from '@domain/appointments/entities/appointment.entity';
import { DepositReceiptStatus } from '@domain/deposits/entities/deposit-receipt.entity';
import {
  AppointmentView,
  AppointmentViewRepository,
} from '@domain/appointments/repositories/appointment-view.repository';
import { ClientSummary } from '@domain/clients/views/client-summary';
import { Currency } from '@domain/common/value-objects/currency.vo';
import { Money } from '@domain/common/value-objects/money.vo';
import { TenantContextService } from '@infrastructure/tenancy/tenant-context.service';

import { DrizzleService } from '../drizzle/drizzle.service';
import {
  appointmentBookingAnswers,
  appointments,
} from '../drizzle/schema/appointment.schema';
import { clients } from '../drizzle/schema/client.schema';
import { depositReceipts } from '../drizzle/schema/deposit-receipt.schema';
import { professionals } from '../drizzle/schema/professional.schema';
import { services } from '../drizzle/schema/service.schema';
import { AppointmentMapper } from '../drizzle/mappers/appointment.mapper';
import { TenantScopedRepository } from './tenant-scoped.repository';

const bookingContacts = alias(clients, 'booking_contacts');

@Injectable()
export class DrizzleAppointmentViewRepository
  extends TenantScopedRepository
  implements AppointmentViewRepository
{
  constructor(drizzle: DrizzleService, tenantContext: TenantContextService) {
    super(drizzle, tenantContext);
  }

  async findById(id: string): Promise<AppointmentView | null> {
    const [view] = await this.findWhere(eq(appointments.id, id));
    return view ?? null;
  }

  async findInRange(input: {
    from: Date;
    toExclusive: Date;
    professionalId?: string;
    professionalIds?: string[];
    serviceIds?: string[];
    statuses?: AppointmentStatus[];
    branchId?: string;
    branchIds?: string[];
  }): Promise<AppointmentView[]> {
    const professionalIds = input.professionalIds?.length
      ? input.professionalIds
      : input.professionalId
        ? [input.professionalId]
        : undefined;

    return this.findWhere(
      gte(appointments.startsAt, input.from),
      lt(appointments.startsAt, input.toExclusive),
      professionalIds?.length
        ? inArray(appointments.professionalId, professionalIds)
        : undefined,
      input.serviceIds?.length
        ? inArray(appointments.serviceId, input.serviceIds)
        : undefined,
      input.statuses?.length
        ? inArray(appointments.status, input.statuses)
        : undefined,
      input.branchId ? eq(appointments.branchId, input.branchId) : undefined,
      !input.branchId && input.branchIds?.length
        ? inArray(appointments.branchId, input.branchIds)
        : undefined,
    );
  }

  async findByClient(input: {
    clientId: string;
    statuses?: AppointmentStatus[];
    from?: Date;
    scope?: 'attendee' | 'managed';
  }): Promise<AppointmentView[]> {
    const identity =
      input.scope === 'managed'
        ? or(
            eq(appointments.clientId, input.clientId),
            eq(appointments.bookingContactClientId, input.clientId),
          )
        : eq(appointments.clientId, input.clientId);

    return this.findWhere(
      identity,
      input.statuses?.length
        ? inArray(appointments.status, input.statuses)
        : undefined,
      input.from ? gte(appointments.startsAt, input.from) : undefined,
    );
  }

  async findAttendeesBookedBy(
    bookingContactClientId: string,
  ): Promise<ClientSummary[]> {
    const rows = await this.drizzle.db
      .selectDistinctOn([clients.id], {
        id: clients.id,
        name: clients.name,
        phoneE164: clients.phoneE164,
      })
      .from(appointments)
      .innerJoin(clients, eq(clients.id, appointments.clientId))
      .where(
        this.scope(
          appointments,
          eq(appointments.bookingContactClientId, bookingContactClientId),
          ne(appointments.clientId, bookingContactClientId),
        ),
      )
      .orderBy(clients.id, clients.name);

    return rows;
  }

  async findByProfessional(input: {
    professionalId: string;
    statuses?: AppointmentStatus[];
    from?: Date;
  }): Promise<AppointmentView[]> {
    return this.findWhere(
      eq(appointments.professionalId, input.professionalId),
      input.statuses?.length
        ? inArray(appointments.status, input.statuses)
        : undefined,
      input.from ? gte(appointments.startsAt, input.from) : undefined,
    );
  }

  // A single query with the joins: both the panel and the agent need the names, and
  // resolving them appointment by appointment would be N+1. The FKs are notNull,
  // so the inner join cannot lose rows.
  private async findWhere(
    ...conditions: (SQL | undefined)[]
  ): Promise<AppointmentView[]> {
    const rows = await this.drizzle.db
      .select({
        appointment: appointments,
        depositReceipt: depositReceipts,
        client: {
          id: clients.id,
          name: clients.name,
          phoneE164: clients.phoneE164,
        },
        bookingContact: {
          id: bookingContacts.id,
          name: bookingContacts.name,
          phoneE164: bookingContacts.phoneE164,
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
      .leftJoin(
        depositReceipts,
        and(
          eq(depositReceipts.tenantId, appointments.tenantId),
          eq(depositReceipts.appointmentId, appointments.id),
          eq(depositReceipts.status, DepositReceiptStatus.ASSIGNED),
        ),
      )
      .innerJoin(clients, eq(clients.id, appointments.clientId))
      .innerJoin(
        bookingContacts,
        eq(bookingContacts.id, appointments.bookingContactClientId),
      )
      .innerJoin(
        professionals,
        eq(professionals.id, appointments.professionalId),
      )
      .innerJoin(services, eq(services.id, appointments.serviceId))
      .where(this.scope(appointments, ...conditions))
      .orderBy(appointments.startsAt);

    const answersByAppointment = await this.answersFor(
      rows.map((row) => row.appointment.id),
    );

    return rows.map((row) => ({
      appointment: AppointmentMapper.toDomain(
        row.appointment,
        answersByAppointment.get(row.appointment.id) ?? [],
        row.depositReceipt,
      ),
      client: row.client,
      bookingContact: row.bookingContact,
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

  private async answersFor(appointmentIds: string[]) {
    const result = new Map<
      string,
      (typeof appointmentBookingAnswers.$inferSelect)[]
    >();
    if (appointmentIds.length === 0) return result;

    const rows = await this.drizzle.db
      .select()
      .from(appointmentBookingAnswers)
      .where(
        and(
          eq(appointmentBookingAnswers.tenantId, this.tenantId),
          inArray(appointmentBookingAnswers.appointmentId, appointmentIds),
        ),
      );

    for (const row of rows) {
      const list = result.get(row.appointmentId) ?? [];
      list.push(row);
      result.set(row.appointmentId, list);
    }
    return result;
  }
}
