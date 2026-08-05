import { ApiProperty } from '@nestjs/swagger';

import { Appointment } from '@domain/appointments/entities/appointment.entity';
import { AppointmentStatus } from '@domain/appointments/entities/appointment.entity';

export class AppointmentResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  clientId: string;

  @ApiProperty()
  professionalId: string;

  @ApiProperty()
  serviceId: string;

  @ApiProperty()
  startsAt: string;

  @ApiProperty()
  endsAt: string;

  @ApiProperty({ enum: AppointmentStatus })
  status: AppointmentStatus;

  static from(appointment: Appointment): AppointmentResponseDto {
    return {
      id: appointment.id,
      clientId: appointment.clientId,
      professionalId: appointment.professionalId,
      serviceId: appointment.serviceId,
      startsAt: appointment.startsAt.toISOString(),
      endsAt: appointment.endsAt.toISOString(),
      status: appointment.status,
    };
  }
}
