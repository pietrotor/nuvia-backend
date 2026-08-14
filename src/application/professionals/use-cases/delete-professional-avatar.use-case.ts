import { Inject, Injectable } from '@nestjs/common';

import { AuditRecorder } from '@application/audit/services/audit-recorder.service';
import { AuditAction } from '@domain/audit/entities/audit-log.entity';
import { Professional } from '@domain/professionals/entities/professional.entity';
import {
  ProfessionalAvatarNotFoundError,
  ProfessionalNotFoundError,
} from '@domain/professionals/exceptions/professional.exceptions';
import {
  PROFESSIONAL_REPOSITORY,
  ProfessionalRepository,
} from '@domain/professionals/repositories/professional.repository';
import {
  OBJECT_STORAGE_PORT,
  ObjectStoragePort,
} from '@domain/storage/ports/object-storage.port';

@Injectable()
export class DeleteProfessionalAvatarUseCase {
  constructor(
    @Inject(PROFESSIONAL_REPOSITORY)
    private readonly professionalRepository: ProfessionalRepository,
    @Inject(OBJECT_STORAGE_PORT)
    private readonly storage: ObjectStoragePort,
    private readonly audit: AuditRecorder,
  ) {}

  async execute(professionalId: string): Promise<Professional> {
    const professional =
      await this.professionalRepository.findById(professionalId);
    if (!professional) throw new ProfessionalNotFoundError(professionalId);
    if (!professional.avatarStorageKey) {
      throw new ProfessionalAvatarNotFoundError(professionalId);
    }

    const previousKey = professional.avatarStorageKey;

    const updated = await this.professionalRepository.update(professionalId, {
      avatarStorageKey: null,
      avatarMimeType: null,
    });
    if (!updated) throw new ProfessionalNotFoundError(professionalId);

    await this.storage.delete(previousKey).catch(() => undefined);

    await this.audit.record({
      action: AuditAction.PROFESSIONAL_AVATAR_REMOVED,
      entity: 'professional',
      entityId: updated.id,
      before: { avatarStorageKey: previousKey },
      after: {
        avatarStorageKey: null,
        avatarMimeType: null,
      },
    });

    return updated;
  }
}
