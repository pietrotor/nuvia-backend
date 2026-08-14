import { Inject, Injectable } from '@nestjs/common';

import { DepositQrNotFoundError } from '@domain/deposits/exceptions/deposit-qr.exceptions';
import {
  DEPOSIT_QR_REPOSITORY,
  DepositQrRepository,
} from '@domain/deposits/repositories/deposit-qr.repository';
import {
  OBJECT_STORAGE_PORT,
  ObjectStoragePort,
} from '@domain/storage/ports/object-storage.port';

export interface DepositQrImage {
  body: Buffer;
  mimeType: string;
}

// Reads the bytes through the port instead of handing out a provider URL, so the
// tenant is checked on every download and the panel behaves the same on local
// storage and on S3.
@Injectable()
export class GetDepositQrImageUseCase {
  constructor(
    @Inject(DEPOSIT_QR_REPOSITORY)
    private readonly depositQrRepository: DepositQrRepository,
    @Inject(OBJECT_STORAGE_PORT)
    private readonly storage: ObjectStoragePort,
  ) {}

  async execute(id: string): Promise<DepositQrImage> {
    const depositQr = await this.depositQrRepository.findById(id);
    if (!depositQr) throw new DepositQrNotFoundError(id);

    const stored = await this.storage.get(depositQr.storageKey);

    return {
      body: stored.body,
      mimeType: stored.contentType ?? depositQr.mimeType,
    };
  }
}
