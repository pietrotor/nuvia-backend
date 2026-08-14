import { Injectable } from '@nestjs/common';
import { and, eq, gt, isNull, lt, ne, inArray } from 'drizzle-orm';

import {
  AppointmentRepository,
  CreateAppointmentData,
} from '@domain/appointments/repositories/appointment.repository';
import {
  ACTIVE_APPOINTMENT_STATUSES,
  Appointment,
} from '@domain/appointments/entities/appointment.entity';
import {
  AppointmentNotFoundError,
  SlotUnavailableError,
} from '@domain/appointments/exceptions/appointment.exceptions';
import { calculateDepositAmount } from '@domain/deposits/services/deposit-amount';
import { TenantContextService } from '@infrastructure/tenancy/tenant-context.service';
import { DatabaseErrorTranslator } from '@infrastructure/errors/database-error.translator';

import { DrizzleService } from '../drizzle/drizzle.service';
import {
  AppointmentSchema,
  appointments,
} from '../drizzle/schema/appointment.schema';
import { services } from '../drizzle/schema/service.schema';
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
      const [created] = await this.insertInto(appointments, {
        branchId: data.branchId,
        clientId: data.clientId,
        professionalId: data.professionalId,
        serviceId: data.serviceId,
        startsAt: data.startsAt,
        endsAt: data.endsAt,
        status: data.status,
        price: data.price,
        currency: data.currency,
        depositAmount: data.depositAmount,
      });
      return AppointmentMapper.toDomain(created);
    } catch (error) {
      if (isSlotTaken(error)) throw new SlotUnavailableError();
      throw DatabaseErrorTranslator.toDomain(error);
    }
  }

  async save(appointment: Appointment): Promise<Appointment> {
    let row: AppointmentSchema | undefined;
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
        eq(appointments.id, appointment.id),
      );
    } catch (error) {
      if (isSlotTaken(error)) throw new SlotUnavailableError();
      throw DatabaseErrorTranslator.toDomain(error);
    }

    if (!row) throw new AppointmentNotFoundError(appointment.id);
    return AppointmentMapper.toDomain(row);
  }

  async findById(id: string): Promise<Appointment | null> {
    const [row] = await this.selectFrom(appointments, eq(appointments.id, id));
    return row ? AppointmentMapper.toDomain(row) : null;
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
    return rows.map(AppointmentMapper.toDomain);
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
    return rows.map(AppointmentMapper.toDomain);
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
    await this.drizzle.db.delete(appointments);
  }
}
