import { ApiProperty } from '@nestjs/swagger';

import {
  Currency,
  currencySymbol,
} from '@domain/common/value-objects/currency.vo';
import { Money } from '@domain/common/value-objects/money.vo';

export class MoneyResponseDto {
  @ApiProperty({ example: '150.00' })
  amount: string;

  @ApiProperty({ enum: Currency })
  currency: Currency;

  @ApiProperty({
    example: 'Bs',
    description: 'Symbol to render the amount with',
  })
  symbol: string;

  static from(money: Money): MoneyResponseDto {
    return {
      amount: money.amount,
      currency: money.currency,
      symbol: currencySymbol(money.currency),
    };
  }
}

export class CurrencyResponseDto {
  @ApiProperty({ enum: Currency })
  code: Currency;

  @ApiProperty({ example: 'Bs' })
  symbol: string;

  static from(currency: Currency): CurrencyResponseDto {
    return { code: currency, symbol: currencySymbol(currency) };
  }
}
