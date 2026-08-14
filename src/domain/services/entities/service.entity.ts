import { Currency } from '@domain/common/value-objects/currency.vo';
import { Money } from '@domain/common/value-objects/money.vo';

export interface ServiceProps {
  id: string;
  tenantId: string;
  name: string;
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
  createdAt?: Date;
  updatedAt?: Date;
}

export class Service {
  public readonly id: string;
  public readonly tenantId: string;
  public readonly name: string;
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
  public readonly createdAt?: Date;
  public readonly updatedAt?: Date;

  constructor(props: ServiceProps) {
    this.id = props.id;
    this.tenantId = props.tenantId;
    this.name = props.name;
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
    this.createdAt = props.createdAt;
    this.updatedAt = props.updatedAt;
  }

  get currency(): Currency {
    return this.price.currency;
  }
}
