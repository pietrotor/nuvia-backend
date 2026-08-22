import { Currency } from '@domain/common/value-objects/currency.vo';
import { Service } from '../entities/service.entity';
import { BookingQuestionKind } from '../value-objects/booking-question-kind.vo';

export interface ServiceBookingQuestionInput {
  id?: string;
  prompt: string;
  kind: BookingQuestionKind;
  isRequired: boolean;
  sortOrder: number;
  isActive?: boolean;
}

export interface CreateServiceData {
  name: string;
  description?: string | null;
  keywords?: string[];
  durationMinutes: number;
  currency: Currency;
  price: string;
  requiresDeposit?: boolean;
  depositAmount?: string | null;
  depositPercent?: number | null;
  depositQrId?: string | null;
  clientChoosesProfessional?: boolean;
  professionalIds: string[];
  isActive?: boolean;
  bookingQuestions?: ServiceBookingQuestionInput[];
}

export interface UpdateServiceData {
  name?: string;
  description?: string | null;
  keywords?: string[];
  durationMinutes?: number;
  currency?: Currency;
  price?: string;
  requiresDeposit?: boolean;
  depositAmount?: string | null;
  depositPercent?: number | null;
  depositQrId?: string | null;
  clientChoosesProfessional?: boolean;
  professionalIds?: string[];
  isActive?: boolean;
  bookingQuestions?: ServiceBookingQuestionInput[];
}

export interface ServiceRepository {
  create(data: CreateServiceData): Promise<Service>;
  findById(id: string): Promise<Service | null>;
  findAll(): Promise<Service[]>;
  update(id: string, data: UpdateServiceData): Promise<Service | null>;
  deleteAllUnscoped(): Promise<void>;
}

export const SERVICE_REPOSITORY = 'ServiceRepository';
