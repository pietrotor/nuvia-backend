import { Currency } from '@domain/common/value-objects/currency.vo';
import { Money } from '@domain/common/value-objects/money.vo';
import {
  Appointment,
  AppointmentStatus,
} from '@domain/appointments/entities/appointment.entity';
import { AppointmentBookingAnswer } from '@domain/appointments/value-objects/appointment-booking-answer.vo';
import { BookingQuestionKind } from '@domain/services/value-objects/booking-question-kind.vo';
import {
  AppointmentBookingAnswerSchema,
  AppointmentSchema,
} from '../schema/appointment.schema';
import { DepositReceiptSchema } from '../schema/deposit-receipt.schema';

export class AppointmentMapper {
  static toDomain(
    row: AppointmentSchema,
    answers: AppointmentBookingAnswerSchema[] = [],
    receipt: DepositReceiptSchema | null = null,
  ): Appointment {
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
      bookingContactClientId: row.bookingContactClientId,
      professionalId: row.professionalId,
      serviceId: row.serviceId,
      startsAt: row.startsAt,
      endsAt: row.endsAt,
      status: row.status as AppointmentStatus,
      price: Money.of(row.price, currency),
      depositAmount: row.depositAmount
        ? Money.of(row.depositAmount, currency)
        : null,
      depositReceipt: receipt
        ? {
            id: receipt.id,
            storageKey: receipt.storageKey,
            mimeType: receipt.mimeType,
            receivedAt: receipt.receivedAt,
            providerMessageId: receipt.providerMessageId,
          }
        : null,
      depositVerifiedAt: row.depositVerifiedAt,
      depositVerifiedByUserId: row.depositVerifiedByUserId,
      bookingAnswers: answers.map(toAnswer),
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    });
  }
}

function toAnswer(
  row: AppointmentBookingAnswerSchema,
): AppointmentBookingAnswer {
  return {
    questionId: row.questionId,
    promptSnapshot: row.promptSnapshot,
    kind: row.kind as BookingQuestionKind,
    value: row.value,
  };
}
