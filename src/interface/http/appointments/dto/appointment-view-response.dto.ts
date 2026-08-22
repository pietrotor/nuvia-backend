import { ApiProperty } from '@nestjs/swagger';

import { AppointmentStatus } from '@domain/appointments/entities/appointment.entity';
import { AppointmentView } from '@domain/appointments/repositories/appointment-view.repository';
import { AppointmentBookingAnswer } from '@domain/appointments/value-objects/appointment-booking-answer.vo';
import { BookingQuestionKind } from '@domain/services/value-objects/booking-question-kind.vo';
import { ClientSummaryResponseDto } from '@interface/http/common/dto/client-summary-response.dto';
import { ProfessionalSummaryResponseDto } from '@interface/http/common/dto/professional-summary-response.dto';
import { ServiceSummaryResponseDto } from '@interface/http/common/dto/service-summary-response.dto';
import { MoneyResponseDto } from '@interface/http/common/dto/money-response.dto';
import { minutesBetween } from '@application/appointments/services/resolve-appointment-duration';

export class AppointmentBookingAnswerResponseDto {
  @ApiProperty({ nullable: true })
  questionId: string | null;

  @ApiProperty()
  prompt: string;

  @ApiProperty({ enum: BookingQuestionKind })
  kind: BookingQuestionKind;

  @ApiProperty()
  value: string;

  static from(
    answer: AppointmentBookingAnswer,
  ): AppointmentBookingAnswerResponseDto {
    return {
      questionId: answer.questionId,
      prompt: answer.promptSnapshot,
      kind: answer.kind,
      value: answer.value,
    };
  }
}

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

  @ApiProperty({ type: ClientSummaryResponseDto })
  bookingContact: ClientSummaryResponseDto;

  @ApiProperty({ type: ProfessionalSummaryResponseDto })
  professional: ProfessionalSummaryResponseDto;

  @ApiProperty({ type: ServiceSummaryResponseDto })
  service: ServiceSummaryResponseDto;

  @ApiProperty({ type: [AppointmentBookingAnswerResponseDto] })
  bookingAnswers: AppointmentBookingAnswerResponseDto[];

  @ApiProperty({ type: MoneyResponseDto, nullable: true })
  depositAmount: MoneyResponseDto | null;

  @ApiProperty()
  hasDepositReceipt: boolean;

  @ApiProperty({ nullable: true })
  depositReceiptReceivedAt: string | null;

  @ApiProperty({ nullable: true })
  depositVerifiedAt: string | null;

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
      bookingContact: ClientSummaryResponseDto.from(view.bookingContact),
      professional: ProfessionalSummaryResponseDto.from(view.professional),
      service: ServiceSummaryResponseDto.from(view.service),
      bookingAnswers: view.appointment.bookingAnswers.map(
        AppointmentBookingAnswerResponseDto.from,
      ),
      depositAmount: view.appointment.depositAmount
        ? MoneyResponseDto.from(view.appointment.depositAmount)
        : null,
      hasDepositReceipt: Boolean(view.appointment.depositReceipt),
      depositReceiptReceivedAt:
        view.appointment.depositReceipt?.receivedAt.toISOString() ?? null,
      depositVerifiedAt:
        view.appointment.depositVerifiedAt?.toISOString() ?? null,
    };
  }
}
