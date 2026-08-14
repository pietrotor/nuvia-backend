import { createHash } from 'crypto';

import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

import { Professional } from '@domain/professionals/entities/professional.entity';

/**
 * Stamps the download path with the photo it points at. Every upload writes a new storage
 * key, so this changes with the picture and never otherwise: the panel and the browser can
 * hold the image for as long as they like and still see a new one the moment it is
 * uploaded. A digest, not the key, so the key still never leaves the API.
 */
const avatarVersion = (storageKey: string): string =>
  createHash('sha256').update(storageKey).digest('hex').slice(0, 12);

export class ProfessionalResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  name: string;

  @ApiProperty()
  isActive: boolean;

  /**
   * Relative API path to download the avatar, versioned by the photo it serves. Null when
   * none was uploaded. The storage key never leaves the API.
   */
  @ApiPropertyOptional({ nullable: true, type: String })
  avatarUrl: string | null;

  static from(professional: Professional): ProfessionalResponseDto {
    return {
      id: professional.id,
      name: professional.name,
      isActive: professional.isActive,
      avatarUrl: professional.avatarStorageKey
        ? `/api/v1/professionals/${professional.id}/avatar?v=${avatarVersion(
            professional.avatarStorageKey,
          )}`
        : null,
    };
  }
}
