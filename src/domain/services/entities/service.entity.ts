import { Currency } from '@domain/common/value-objects/currency.vo';
import { Money } from '@domain/common/value-objects/money.vo';

import { ServiceBookingQuestion } from './service-booking-question.entity';

export interface ServiceProps {
  id: string;
  tenantId: string;
  name: string;
  description?: string | null;
  keywords?: string[];
  durationMinutes: number;
  currency: Currency;
  price: string;
  requiresDeposit: boolean;
  depositAmount: string | null;
  depositPercent: number | null;
  depositQrId: string | null;
  clientChoosesProfessional: boolean;
  isActive: boolean;
  professionalIds: string[];
  bookingQuestions?: ServiceBookingQuestion[];
  createdAt?: Date;
  updatedAt?: Date;
}

export class Service {
  public readonly id: string;
  public readonly tenantId: string;
  public readonly name: string;
  public readonly description: string | null;
  public readonly keywords: string[];
  public readonly durationMinutes: number;
  public readonly price: Money;
  public readonly requiresDeposit: boolean;
  public readonly depositAmount: Money | null;
  public readonly depositPercent: number | null;
  // Null means the deposit is charged with the QR the business marked as default.
  public readonly depositQrId: string | null;
  public readonly clientChoosesProfessional: boolean;
  public readonly isActive: boolean;
  public readonly professionalIds: string[];
  public readonly bookingQuestions: ServiceBookingQuestion[];
  public readonly createdAt?: Date;
  public readonly updatedAt?: Date;

  constructor(props: ServiceProps) {
    this.id = props.id;
    this.tenantId = props.tenantId;
    this.name = props.name;
    this.description = props.description ?? null;
    this.keywords = props.keywords ?? [];
    this.durationMinutes = props.durationMinutes;
    // One currency per service: taking it from a single prop is what makes a deposit
    // in a different currency than its price impossible to represent.
    this.price = Money.of(props.price, props.currency);
    this.requiresDeposit = props.requiresDeposit;
    this.depositAmount = props.depositAmount
      ? Money.of(props.depositAmount, props.currency)
      : null;
    this.depositPercent = props.depositPercent;
    this.depositQrId = props.depositQrId;
    this.clientChoosesProfessional = props.clientChoosesProfessional;
    this.isActive = props.isActive;
    this.professionalIds = props.professionalIds;
    this.bookingQuestions = props.bookingQuestions ?? [];
    this.createdAt = props.createdAt;
    this.updatedAt = props.updatedAt;
  }

  activeBookingQuestions(): ServiceBookingQuestion[] {
    return [...this.bookingQuestions]
      .filter((question) => question.isActive)
      .sort((a, b) => a.sortOrder - b.sortOrder);
  }

  get currency(): Currency {
    return this.price.currency;
  }
}
