import { ApiProperty } from '@nestjs/swagger';

import { Service } from '@domain/services/entities/service.entity';
import { ServiceBookingQuestion } from '@domain/services/entities/service-booking-question.entity';
import { BookingQuestionKind } from '@domain/services/value-objects/booking-question-kind.vo';

import { MoneyResponseDto } from '@interface/http/common/dto/money-response.dto';

export class ServiceBookingQuestionResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  prompt: string;

  @ApiProperty({ enum: BookingQuestionKind })
  kind: BookingQuestionKind;

  @ApiProperty()
  isRequired: boolean;

  @ApiProperty()
  sortOrder: number;

  @ApiProperty()
  isActive: boolean;

  static from(
    question: ServiceBookingQuestion,
  ): ServiceBookingQuestionResponseDto {
    return {
      id: question.id,
      prompt: question.prompt,
      kind: question.kind,
      isRequired: question.isRequired,
      sortOrder: question.sortOrder,
      isActive: question.isActive,
    };
  }
}

export class ServiceResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  name: string;

  @ApiProperty({ nullable: true })
  description: string | null;

  @ApiProperty({ type: [String] })
  keywords: string[];

  @ApiProperty()
  durationMinutes: number;

  @ApiProperty({ type: MoneyResponseDto })
  price: MoneyResponseDto;

  @ApiProperty()
  requiresDeposit: boolean;

  @ApiProperty({ type: MoneyResponseDto, nullable: true })
  depositAmount: MoneyResponseDto | null;

  @ApiProperty({ nullable: true })
  depositPercent: number | null;

  @ApiProperty({
    nullable: true,
    description: 'Null charges the deposit with the default QR of the business',
  })
  depositQrId: string | null;

  @ApiProperty({ type: [String] })
  professionalIds: string[];

  @ApiProperty({ type: [ServiceBookingQuestionResponseDto] })
  bookingQuestions: ServiceBookingQuestionResponseDto[];

  @ApiProperty()
  clientChoosesProfessional: boolean;

  @ApiProperty()
  isActive: boolean;

  static from(service: Service): ServiceResponseDto {
    return {
      id: service.id,
      name: service.name,
      description: service.description,
      keywords: service.keywords,
      durationMinutes: service.durationMinutes,
      price: MoneyResponseDto.from(service.price),
      requiresDeposit: service.requiresDeposit,
      depositAmount: service.depositAmount
        ? MoneyResponseDto.from(service.depositAmount)
        : null,
      depositPercent: service.depositPercent,
      depositQrId: service.depositQrId,
      professionalIds: service.professionalIds,
      bookingQuestions: service.bookingQuestions.map(
        ServiceBookingQuestionResponseDto.from,
      ),
      clientChoosesProfessional: service.clientChoosesProfessional,
      isActive: service.isActive,
    };
  }
}
