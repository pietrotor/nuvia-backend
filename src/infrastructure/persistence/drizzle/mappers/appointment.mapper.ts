import { Currency } from '@domain/common/value-objects/currency.vo';
import { Money } from '@domain/common/value-objects/money.vo';
import {
  Appointment,
  AppointmentStatus,
} from '@domain/appointments/entities/appointment.entity';
import { AppointmentSchema } from '../schema/appointment.schema';

export class AppointmentMapper {
  static toDomain(row: AppointmentSchema): Appointment {
    if (!row.branchId) {
      throw new Error(`Appointment ${row.id} is missing required branch_id`);
    }
    if (!row.price || !row.currency) {
      throw new Error(
        `Appointment ${row.id} is missing required price/currency snapshot`,
      );
    }

    const currency = row.currency as Currency;

    return new Appointment({
      id: row.id,
      tenantId: row.tenantId,
      branchId: row.branchId,
      clientId: row.clientId,
      professionalId: row.professionalId,
      serviceId: row.serviceId,
      startsAt: row.startsAt,
      endsAt: row.endsAt,
      status: row.status as AppointmentStatus,
      price: Money.of(row.price, currency),
      depositAmount: row.depositAmount
        ? Money.of(row.depositAmount, currency)
        : null,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    });
  }
}
