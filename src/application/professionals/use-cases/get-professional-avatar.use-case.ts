import { Inject, Injectable } from '@nestjs/common';

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

export interface ProfessionalAvatarImage {
  body: Buffer;
  mimeType: string;
}

@Injectable()
export class GetProfessionalAvatarUseCase {
  constructor(
    @Inject(PROFESSIONAL_REPOSITORY)
    private readonly professionalRepository: ProfessionalRepository,
    @Inject(OBJECT_STORAGE_PORT)
    private readonly storage: ObjectStoragePort,
  ) {}

  async execute(professionalId: string): Promise<ProfessionalAvatarImage> {
    const professional =
      await this.professionalRepository.findById(professionalId);
    if (!professional) throw new ProfessionalNotFoundError(professionalId);
    if (!professional.avatarStorageKey) {
      throw new ProfessionalAvatarNotFoundError(professionalId);
    }

    const stored = await this.storage.get(professional.avatarStorageKey);

    return {
      body: stored.body,
      mimeType:
        stored.contentType ?? professional.avatarMimeType ?? 'image/jpeg',
    };
  }
}
