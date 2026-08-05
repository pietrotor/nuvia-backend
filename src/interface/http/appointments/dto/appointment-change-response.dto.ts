import { ApiProperty } from '@nestjs/swagger';

import { Appointment } from '@domain/appointments/entities/appointment.entity';
import { AppointmentResponseDto } from './appointment-response.dto';

export class AppointmentChangeResponseDto {
  @ApiProperty({ type: AppointmentResponseDto })
  appointment: AppointmentResponseDto;

  @ApiProperty({
    description:
      'The change happened outside the policy window: the deposit may be withheld',
  })
  depositAtRisk: boolean;

  static from(result: {
    appointment: Appointment;
    depositAtRisk: boolean;
  }): AppointmentChangeResponseDto {
    return {
      appointment: AppointmentResponseDto.from(result.appointment),
      depositAtRisk: result.depositAtRisk,
    };
  }
}
