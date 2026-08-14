import { DepositQr } from '@domain/deposits/entities/deposit-qr.entity';

import { DepositQrSchema } from '../schema/deposit.schema';

export class DepositQrMapper {
  static toDomain(row: DepositQrSchema): DepositQr {
    return new DepositQr({
      id: row.id,
      tenantId: row.tenantId,
      branchId: row.branchId,
      label: row.label,
      storageKey: row.storageKey,
      mimeType: row.mimeType,
      sizeBytes: row.sizeBytes,
      isDefault: row.isDefault,
      isActive: row.isActive,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    });
  }
}
