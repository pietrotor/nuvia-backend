import { Money } from '@domain/common/value-objects/money.vo';

export interface ServiceSummary {
  id: string;
  name: string;
  durationMinutes: number;
  price: Money;
  requiresDeposit: boolean;
}
