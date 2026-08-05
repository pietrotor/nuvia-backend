import { Injectable } from '@nestjs/common';
import { and, eq, gt, lt, ne, inArray } from 'drizzle-orm';

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
import { TenantContextService } from '@infrastructure/tenancy/tenant-context.service';
import { DatabaseErrorTranslator } from '@infrastructure/errors/database-error.translator';

import { DrizzleService } from '../drizzle/drizzle.service';
import {
  AppointmentSchema,
  appointments,
} from '../drizzle/schema/appointment.schema';
import { AppointmentMapper } from '../drizzle/mappers/appointment.mapper';
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
        clientId: data.clientId,
        professionalId: data.professionalId,
        serviceId: data.serviceId,
        startsAt: data.startsAt,
        endsAt: data.endsAt,
        status: data.status,
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
          professionalId: appointment.professionalId,
          startsAt: appointment.startsAt,
          endsAt: appointment.endsAt,
          status: appointment.status,
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

  async deleteAllUnscoped(): Promise<void> {
    await this.drizzle.db.delete(appointments);
  }
}
