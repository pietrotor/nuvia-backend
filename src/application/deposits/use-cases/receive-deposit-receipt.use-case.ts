import { randomUUID } from 'node:crypto';

import { Inject, Injectable } from '@nestjs/common';

import { TenantContextMissingError } from '@domain/common/exceptions';
import {
  DepositReceipt,
  DepositReceiptClassification,
  DepositReceiptSource,
} from '@domain/deposits/entities/deposit-receipt.entity';
import {
  DEPOSIT_RECEIPT_REPOSITORY,
  DepositReceiptRepository,
} from '@domain/deposits/repositories/deposit-receipt.repository';
import { assertValidDepositReceiptImage } from '@domain/deposits/services/deposit-receipt-image-validator';
import {
  OBJECT_STORAGE_PORT,
  ObjectStoragePort,
} from '@domain/storage/ports/object-storage.port';
import {
  TENANT_CONTEXT_PORT,
  TenantContextPort,
} from '@domain/tenants/ports/tenant-context.port';
export interface DepositReceiptImage {
  body: Buffer;
  mimeType: string;
}

const EXTENSION_BY_MIME_TYPE: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
};

@Injectable()
export class ReceiveDepositReceiptUseCase {
  constructor(
    @Inject(DEPOSIT_RECEIPT_REPOSITORY)
    private readonly receipts: DepositReceiptRepository,
    @Inject(OBJECT_STORAGE_PORT)
    private readonly storage: ObjectStoragePort,
    @Inject(TENANT_CONTEXT_PORT)
    private readonly tenantContext: TenantContextPort,
  ) {}

  async execute(input: {
    conversationId: string | null;
    clientId: string;
    image: DepositReceiptImage;
    providerMessageId: string | null;
    receivedAt: Date;
    source: DepositReceiptSource;
    classification: DepositReceiptClassification;
  }): Promise<DepositReceipt> {
    assertValidDepositReceiptImage({
      mimeType: input.image.mimeType,
      body: input.image.body,
    });
    if (input.providerMessageId) {
      const duplicate = await this.receipts.findByProviderMessageId(
        input.providerMessageId,
      );
      if (duplicate) return duplicate;
    }

    const storageKey = this.storageKeyFor(input.image.mimeType);
    await this.storage.store({
      key: storageKey,
      body: input.image.body,
      contentType: input.image.mimeType,
    });
    try {
      return await this.receipts.create({
        conversationId: input.conversationId,
        clientId: input.clientId,
        providerMessageId: input.providerMessageId,
        storageKey,
        mimeType: input.image.mimeType,
        receivedAt: input.receivedAt,
        source: input.source,
        classification: input.classification,
      });
    } catch (error) {
      await this.storage.delete(storageKey).catch(() => undefined);
      if (input.providerMessageId) {
        const duplicate = await this.receipts.findByProviderMessageId(
          input.providerMessageId,
        );
        if (duplicate) return duplicate;
      }
      throw error;
    }
  }

  private storageKeyFor(mimeType: string): string {
    const tenantId = this.tenantContext.tenantId;
    if (!tenantId) {
      throw new TenantContextMissingError(ReceiveDepositReceiptUseCase.name);
    }
    return `tenants/${tenantId}/deposit-receipts/${randomUUID()}.${EXTENSION_BY_MIME_TYPE[mimeType] ?? 'bin'}`;
  }
}
