import {
  DepositReceipt,
  DepositReceiptClassification,
  DepositReceiptSource,
  DepositReceiptStatus,
} from '@domain/deposits/entities/deposit-receipt.entity';
import { DepositReceiptSchema } from '../schema/deposit-receipt.schema';

export class DepositReceiptMapper {
  static toDomain(row: DepositReceiptSchema): DepositReceipt {
    return new DepositReceipt({
      ...row,
      status: row.status as DepositReceiptStatus,
      source: row.source as DepositReceiptSource,
      classification: row.classification as DepositReceiptClassification,
    });
  }
}
