import { randomUUID } from 'crypto';

import { Inject, Injectable } from '@nestjs/common';

import { AuditRecorder } from '@application/audit/services/audit-recorder.service';
import { AuditAction } from '@domain/audit/entities/audit-log.entity';
import { TenantContextMissingError } from '@domain/common/exceptions';
import { DepositQr } from '@domain/deposits/entities/deposit-qr.entity';
import {
  DEPOSIT_QR_REPOSITORY,
  DepositQrRepository,
} from '@domain/deposits/repositories/deposit-qr.repository';
import { assertValidDepositQrImage } from '@domain/deposits/services/deposit-qr-image-validator';
import {
  OBJECT_STORAGE_PORT,
  ObjectStoragePort,
} from '@domain/storage/ports/object-storage.port';
import {
  TENANT_CONTEXT_PORT,
  TenantContextPort,
} from '@domain/tenants/ports/tenant-context.port';
import { UploadDepositQrDto } from '../dto/upload-deposit-qr.dto';

const EXTENSION_BY_MIME_TYPE: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
};

export interface UploadDepositQrImage {
  body: Buffer;
  mimeType: string;
}

@Injectable()
export class UploadDepositQrUseCase {
  constructor(
    @Inject(DEPOSIT_QR_REPOSITORY)
    private readonly depositQrRepository: DepositQrRepository,
    @Inject(OBJECT_STORAGE_PORT)
    private readonly storage: ObjectStoragePort,
    @Inject(TENANT_CONTEXT_PORT)
    private readonly tenantContext: TenantContextPort,
    private readonly audit: AuditRecorder,
  ) {}

  async execute(
    dto: UploadDepositQrDto,
    image: UploadDepositQrImage,
  ): Promise<DepositQr> {
    assertValidDepositQrImage({
      mimeType: image.mimeType,
      body: image.body,
    });

    const existing = await this.depositQrRepository.findAll();
    const storageKey = this.storageKeyFor(image.mimeType);

    await this.storage.store({
      key: storageKey,
      body: image.body,
      contentType: image.mimeType,
    });

    const created = await this.depositQrRepository.create({
      label: dto.label.trim(),
      storageKey,
      mimeType: image.mimeType,
      sizeBytes: image.body.length,
      // A business with a single QR should not have to configure a default.
      isDefault: existing.length === 0,
    });

    await this.audit.record({
      action: AuditAction.DEPOSIT_QR_UPLOADED,
      entity: 'deposit_qr',
      entityId: created.id,
      after: {
        label: created.label,
        storageKey: created.storageKey,
        isDefault: created.isDefault,
      },
    });

    return created;
  }

  // Tenant first so a bucket listing is already partitioned by business, and a random
  // name so re-uploading never overwrites a QR another row still points at.
  private storageKeyFor(mimeType: string): string {
    const tenantId = this.tenantContext.tenantId;
    if (!tenantId) {
      throw new TenantContextMissingError(UploadDepositQrUseCase.name);
    }
    const extension = EXTENSION_BY_MIME_TYPE[mimeType];

    return `tenants/${tenantId}/deposit-qrs/${randomUUID()}.${extension}`;
  }
}
