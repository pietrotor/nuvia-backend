import { randomUUID } from 'crypto';

import { Inject, Injectable } from '@nestjs/common';

import { AuditRecorder } from '@application/audit/services/audit-recorder.service';
import { AuditAction } from '@domain/audit/entities/audit-log.entity';
import { TenantContextMissingError } from '@domain/common/exceptions';
import { Professional } from '@domain/professionals/entities/professional.entity';
import {
  InvalidProfessionalAvatarFileError,
  ProfessionalNotFoundError,
} from '@domain/professionals/exceptions/professional.exceptions';
import {
  PROFESSIONAL_REPOSITORY,
  ProfessionalRepository,
} from '@domain/professionals/repositories/professional.repository';
import {
  assertValidProfessionalAvatarImage,
  PROFESSIONAL_AVATAR_MAX_SIZE_MB,
} from '@domain/professionals/services/professional-avatar-image-validator';
import {
  OBJECT_STORAGE_PORT,
  ObjectStoragePort,
} from '@domain/storage/ports/object-storage.port';
import {
  TENANT_CONTEXT_PORT,
  TenantContextPort,
} from '@domain/tenants/ports/tenant-context.port';

const EXTENSION_BY_MIME_TYPE: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
};

export interface UploadProfessionalAvatarImage {
  body: Buffer;
  mimeType: string;
}

@Injectable()
export class UploadProfessionalAvatarUseCase {
  constructor(
    @Inject(PROFESSIONAL_REPOSITORY)
    private readonly professionalRepository: ProfessionalRepository,
    @Inject(OBJECT_STORAGE_PORT)
    private readonly storage: ObjectStoragePort,
    @Inject(TENANT_CONTEXT_PORT)
    private readonly tenantContext: TenantContextPort,
    private readonly audit: AuditRecorder,
  ) {}

  async execute(
    professionalId: string,
    image: UploadProfessionalAvatarImage,
  ): Promise<Professional> {
    if (!image.body?.length) {
      throw new InvalidProfessionalAvatarFileError(
        PROFESSIONAL_AVATAR_MAX_SIZE_MB,
      );
    }

    assertValidProfessionalAvatarImage({
      mimeType: image.mimeType,
      body: image.body,
    });

    const professional =
      await this.professionalRepository.findById(professionalId);
    if (!professional) throw new ProfessionalNotFoundError(professionalId);

    const storageKey = this.storageKeyFor(professionalId, image.mimeType);
    const previousKey = professional.avatarStorageKey;

    await this.storage.store({
      key: storageKey,
      body: image.body,
      contentType: image.mimeType,
    });

    const updated = await this.professionalRepository.update(professionalId, {
      avatarStorageKey: storageKey,
      avatarMimeType: image.mimeType,
    });
    if (!updated) throw new ProfessionalNotFoundError(professionalId);

    if (previousKey && previousKey !== storageKey) {
      await this.storage.delete(previousKey).catch(() => undefined);
    }

    await this.audit.record({
      action: AuditAction.PROFESSIONAL_AVATAR_UPLOADED,
      entity: 'professional',
      entityId: updated.id,
      after: {
        avatarStorageKey: updated.avatarStorageKey,
        avatarMimeType: updated.avatarMimeType,
      },
    });

    return updated;
  }

  private storageKeyFor(professionalId: string, mimeType: string): string {
    const tenantId = this.tenantContext.tenantId;
    if (!tenantId) {
      throw new TenantContextMissingError(UploadProfessionalAvatarUseCase.name);
    }
    const extension = EXTENSION_BY_MIME_TYPE[mimeType];

    return `tenants/${tenantId}/professionals/${professionalId}/${randomUUID()}.${extension}`;
  }
}
