import { ApiProperty } from '@nestjs/swagger';

import { AppointmentStatus } from '@domain/appointments/entities/appointment.entity';
import { AppointmentView } from '@domain/appointments/repositories/appointment-view.repository';
import { ClientSummaryResponseDto } from '@interface/http/common/dto/client-summary-response.dto';
import { ProfessionalSummaryResponseDto } from '@interface/http/common/dto/professional-summary-response.dto';
import { ServiceSummaryResponseDto } from '@interface/http/common/dto/service-summary-response.dto';
import { minutesBetween } from '@application/appointments/services/resolve-appointment-duration';

export class AppointmentViewResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  startsAt: string;

  @ApiProperty()
  endsAt: string;

  /**
   * Length of this appointment instance (`endsAt - startsAt`). May differ from
   * `service.durationMinutes`, which is the catalog default.
   */
  @ApiProperty({
    description:
      'Minutes this appointment lasts. Derived from endsAt − startsAt. service.durationMinutes is the catalog default and may differ when staff shortened or stretched the slot.',
  })
  durationMinutes: number;

  @ApiProperty({ enum: AppointmentStatus })
  status: AppointmentStatus;

  @ApiProperty({ type: ClientSummaryResponseDto })
  client: ClientSummaryResponseDto;

  @ApiProperty({ type: ProfessionalSummaryResponseDto })
  professional: ProfessionalSummaryResponseDto;

  @ApiProperty({ type: ServiceSummaryResponseDto })
  service: ServiceSummaryResponseDto;

  static from(view: AppointmentView): AppointmentViewResponseDto {
    return {
      id: view.appointment.id,
      startsAt: view.appointment.startsAt.toISOString(),
      endsAt: view.appointment.endsAt.toISOString(),
      durationMinutes: minutesBetween(
        view.appointment.startsAt,
        view.appointment.endsAt,
      ),
      status: view.appointment.status,
      client: ClientSummaryResponseDto.from(view.client),
      professional: ProfessionalSummaryResponseDto.from(view.professional),
      service: ServiceSummaryResponseDto.from(view.service),
    };
  }
}
