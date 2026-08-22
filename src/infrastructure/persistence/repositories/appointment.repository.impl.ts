import { Injectable } from '@nestjs/common';
import { and, eq, gt, isNull, lt, ne, inArray } from 'drizzle-orm';

import {
  AppointmentRepository,
  CreateAppointmentData,
} from '@domain/appointments/repositories/appointment.repository';
import {
  ACTIVE_APPOINTMENT_STATUSES,
  Appointment,
  AppointmentStatus,
} from '@domain/appointments/entities/appointment.entity';
import {
  AppointmentNotFoundError,
  SlotUnavailableError,
} from '@domain/appointments/exceptions/appointment.exceptions';
import { calculateDepositAmount } from '@domain/deposits/services/deposit-amount';
import { DepositReceiptStatus } from '@domain/deposits/entities/deposit-receipt.entity';
import { TenantContextService } from '@infrastructure/tenancy/tenant-context.service';
import { DatabaseErrorTranslator } from '@infrastructure/errors/database-error.translator';

import { DrizzleService } from '../drizzle/drizzle.service';
import {
  AppointmentSchema,
  appointmentBookingAnswers,
  appointments,
} from '../drizzle/schema/appointment.schema';
import { services } from '../drizzle/schema/service.schema';
import {
  depositReceiptExpectations,
  depositReceipts,
} from '../drizzle/schema/deposit-receipt.schema';
import {
  appointmentNotificationDeliveries,
  appointmentNotificationEvents,
  appointmentNotificationSubscriptions,
  notificationContacts,
} from '../drizzle/schema/appointment-notification.schema';
import { appointmentReminders } from '../drizzle/schema/appointment-reminder.schema';
import { messages } from '../drizzle/schema/conversation.schema';
import { AppointmentMapper } from '../drizzle/mappers/appointment.mapper';
import { ServiceMapper } from '../drizzle/mappers/service.mapper';
import { TenantScopedRepository } from './tenant-scoped.repository';

// 23P01 = exclusion_violation: raised by `appointments_no_active_overlap` when two
// simultaneous bookings land on the same slot and the previous check was not enough.
const EXCLUSION_VIOLATION = '23P01';

function isSlotTaken(error: unknown): boolean {
  return (error as { code?: string })?.code === EXCLUSION_VIOLATION;
}

@Injectable()
export class DrizzleAppointmentRepository
  extends TenantScopedRepository
  implements AppointmentRepository
{
  constructor(drizzle: DrizzleService, tenantContext: TenantContextService) {
    super(drizzle, tenantContext);
  }

  async create(data: CreateAppointmentData): Promise<Appointment> {
    try {
      return await this.drizzle.db.transaction(async (tx) => {
        const tenantId = this.tenantId;
        const [created] = await tx
          .insert(appointments)
          .values({
            tenantId,
            branchId: data.branchId,
            clientId: data.clientId,
            bookingContactClientId: data.bookingContactClientId,
            professionalId: data.professionalId,
            serviceId: data.serviceId,
            startsAt: data.startsAt,
            endsAt: data.endsAt,
            status: data.status,
            price: data.price,
            currency: data.currency,
            depositAmount: data.depositAmount,
          })
          .returning();

        const answers = data.bookingAnswers ?? [];
        let storedAnswers: (typeof appointmentBookingAnswers.$inferSelect)[] =
          [];
        if (answers.length > 0) {
          storedAnswers = await tx
            .insert(appointmentBookingAnswers)
            .values(
              answers.map((answer) => ({
                tenantId,
                appointmentId: created.id,
                questionId: answer.questionId,
                promptSnapshot: answer.promptSnapshot,
                kind: answer.kind,
                value: answer.value,
              })),
            )
            .returning();
        }

        return AppointmentMapper.toDomain(created, storedAnswers);
      });
    } catch (error) {
      if (isSlotTaken(error)) throw new SlotUnavailableError();
      throw DatabaseErrorTranslator.toDomain(error);
    }
  }

  async save(appointment: Appointment): Promise<Appointment> {
    let row: AppointmentSchema | undefined;
    const expectedStatuses =
      appointment.status === AppointmentStatus.ATTENDED ||
      appointment.status === AppointmentStatus.NO_SHOW
        ? [AppointmentStatus.CONFIRMED]
        : appointment.status === AppointmentStatus.CANCELLED
          ? ACTIVE_APPOINTMENT_STATUSES
          : appointment.status === AppointmentStatus.RELEASED
            ? [AppointmentStatus.PENDING_DEPOSIT]
            : [appointment.status];
    try {
      [row] = await this.updateIn(
        appointments,
        {
          branchId: appointment.branchId,
          professionalId: appointment.professionalId,
          startsAt: appointment.startsAt,
          endsAt: appointment.endsAt,
          status: appointment.status,
          price: appointment.price.amount,
          currency: appointment.price.currency,
          depositAmount: appointment.depositAmount?.amount ?? null,
        },
        and(
          eq(appointments.id, appointment.id),
          inArray(appointments.status, expectedStatuses),
        ),
      );
    } catch (error) {
      if (isSlotTaken(error)) throw new SlotUnavailableError();
      throw DatabaseErrorTranslator.toDomain(error);
    }

    if (!row) throw new AppointmentNotFoundError(appointment.id);
    return AppointmentMapper.toDomain(
      row,
      await this.answersFor([appointment.id]),
      await this.receiptFor(appointment.id),
    );
  }

  async saveDepositConfirmation(
    appointment: Appointment,
  ): Promise<Appointment | null> {
    const [row] = await this.updateIn(
      appointments,
      {
        status: appointment.status,
        depositVerifiedAt: appointment.depositVerifiedAt,
        depositVerifiedByUserId: appointment.depositVerifiedByUserId,
      },
      and(
        eq(appointments.id, appointment.id),
        eq(appointments.status, AppointmentStatus.PENDING_DEPOSIT),
      ),
    );
    if (!row) return null;
    return AppointmentMapper.toDomain(
      row,
      await this.answersFor([appointment.id]),
      await this.receiptFor(appointment.id),
    );
  }

  async findById(id: string): Promise<Appointment | null> {
    const [row] = await this.selectFrom(appointments, eq(appointments.id, id));
    if (!row) return null;
    return AppointmentMapper.toDomain(
      row,
      await this.answersFor([id]),
      await this.receiptFor(id),
    );
  }

  async findByIdForUpdate(id: string): Promise<Appointment | null> {
    const [row] = await this.drizzle.db
      .select()
      .from(appointments)
      .where(this.scope(appointments, eq(appointments.id, id)))
      .for('update')
      .limit(1);
    if (!row) return null;
    return AppointmentMapper.toDomain(
      row,
      await this.answersFor([id]),
      await this.receiptFor(id),
    );
  }

  async findOverlapping(input: {
    professionalId: string;
    startsAt: Date;
    endsAt: Date;
    excludeAppointmentId?: string;
  }): Promise<Appointment[]> {
    const rows = await this.selectFrom(
      appointments,
      and(
        eq(appointments.professionalId, input.professionalId),
        inArray(appointments.status, ACTIVE_APPOINTMENT_STATUSES),
        lt(appointments.startsAt, input.endsAt),
        gt(appointments.endsAt, input.startsAt),
        input.excludeAppointmentId
          ? ne(appointments.id, input.excludeAppointmentId)
          : undefined,
      )!,
    );
    return rows.map((row) => AppointmentMapper.toDomain(row));
  }

  async findByProfessionalInRange(input: {
    professionalId: string;
    from: Date;
    to: Date;
  }): Promise<Appointment[]> {
    const rows = await this.selectFrom(
      appointments,
      and(
        eq(appointments.professionalId, input.professionalId),
        lt(appointments.startsAt, input.to),
        gt(appointments.endsAt, input.from),
      )!,
    );
    return rows.map((row) => AppointmentMapper.toDomain(row));
  }

  async backfillBranchAndPriceSnapshots(branchId: string): Promise<number> {
    const rows = await this.drizzle.db
      .select({
        appointmentId: appointments.id,
        service: services,
      })
      .from(appointments)
      .innerJoin(services, eq(appointments.serviceId, services.id))
      .where(this.scope(appointments, isNull(appointments.branchId)));

    for (const row of rows) {
      const service = ServiceMapper.toDomain(row.service, []);
      const deposit = calculateDepositAmount(service);

      await this.updateIn(
        appointments,
        {
          branchId,
          price: service.price.amount,
          currency: service.currency,
          depositAmount: deposit?.amount ?? null,
        },
        eq(appointments.id, row.appointmentId),
      );
    }

    return rows.length;
  }

  async deleteAllUnscoped(): Promise<void> {
    await this.drizzle.db.delete(appointmentBookingAnswers);
    await this.drizzle.db.delete(appointmentNotificationDeliveries);
    await this.drizzle.db.delete(appointmentNotificationEvents);
    await this.drizzle.db.delete(appointmentNotificationSubscriptions);
    await this.drizzle.db.delete(notificationContacts);
    await this.drizzle.db.delete(appointmentReminders);
    await this.drizzle.db.delete(depositReceiptExpectations);
    await this.drizzle.db.delete(depositReceipts);
    await this.drizzle.db.update(messages).set({ relatedAppointmentId: null });
    await this.drizzle.db.delete(appointments);
  }

  private async answersFor(appointmentIds: string[]) {
    if (appointmentIds.length === 0) return [];
    return this.drizzle.db
      .select()
      .from(appointmentBookingAnswers)
      .where(
        and(
          eq(appointmentBookingAnswers.tenantId, this.tenantId),
          inArray(appointmentBookingAnswers.appointmentId, appointmentIds),
        ),
      );
  }

  private async receiptFor(appointmentId: string) {
    const [receipt] = await this.drizzle.db
      .select()
      .from(depositReceipts)
      .where(
        and(
          eq(depositReceipts.tenantId, this.tenantId),
          eq(depositReceipts.appointmentId, appointmentId),
          eq(depositReceipts.status, DepositReceiptStatus.ASSIGNED),
        ),
      )
      .limit(1);
    return receipt ?? null;
  }
}
