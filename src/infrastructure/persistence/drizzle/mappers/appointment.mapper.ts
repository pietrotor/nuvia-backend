import {
  Appointment,
  AppointmentStatus,
} from '@domain/appointments/entities/appointment.entity';
import { AppointmentSchema } from '../schema/appointment.schema';

export class AppointmentMapper {
  static toDomain(row: AppointmentSchema): Appointment {
    return new Appointment({
      id: row.id,
      tenantId: row.tenantId,
      clientId: row.clientId,
      professionalId: row.professionalId,
      serviceId: row.serviceId,
      startsAt: row.startsAt,
      endsAt: row.endsAt,
      status: row.status as AppointmentStatus,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    });
  }
}
