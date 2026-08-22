import { Currency } from '@domain/common/value-objects/currency.vo';
import { Service } from '@domain/services/entities/service.entity';
import { ServiceBookingQuestion } from '@domain/services/entities/service-booking-question.entity';
import { BookingQuestionKind } from '@domain/services/value-objects/booking-question-kind.vo';
import {
  ServiceBookingQuestionSchema,
  ServiceSchema,
} from '../schema/service.schema';

export class ServiceMapper {
  static toDomain(
    row: ServiceSchema,
    professionalIds: string[],
    bookingQuestions: ServiceBookingQuestionSchema[] = [],
  ): Service {
    return new Service({
      id: row.id,
      tenantId: row.tenantId,
      name: row.name,
      description: row.description,
      keywords: row.keywords ?? [],
      durationMinutes: row.durationMinutes,
      currency: row.currency as Currency,
      price: row.price,
      requiresDeposit: row.requiresDeposit,
      depositAmount: row.depositAmount,
      depositPercent: row.depositPercent,
      depositQrId: row.depositQrId,
      clientChoosesProfessional: row.clientChoosesProfessional,
      isActive: row.isActive,
      professionalIds,
      bookingQuestions: bookingQuestions
        .map(toQuestion)
        .sort((a, b) => a.sortOrder - b.sortOrder),
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    });
  }
}

function toQuestion(row: ServiceBookingQuestionSchema): ServiceBookingQuestion {
  return new ServiceBookingQuestion({
    id: row.id,
    tenantId: row.tenantId,
    serviceId: row.serviceId,
    prompt: row.prompt,
    kind: row.kind as BookingQuestionKind,
    isRequired: row.isRequired,
    sortOrder: row.sortOrder,
    isActive: row.isActive,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  });
}
