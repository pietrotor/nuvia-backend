import { ApiProperty } from '@nestjs/swagger';

import {
  BusinessCategory,
  CategoryLexicon,
  categoryLexicon,
} from '@domain/business-config/value-objects/business-category.vo';

export class CategoryLexiconResponseDto implements CategoryLexicon {
  @ApiProperty({ example: 'cliente' })
  client: string;

  @ApiProperty({ example: 'clientes' })
  clientPlural: string;

  @ApiProperty({ example: 'profesional' })
  professional: string;

  @ApiProperty({ example: 'profesionales' })
  professionalPlural: string;

  @ApiProperty({ example: 'servicio' })
  service: string;

  @ApiProperty({ example: 'servicios' })
  servicePlural: string;

  @ApiProperty({ example: 'sesión' })
  session: string;

  @ApiProperty({ example: 'sesiones' })
  sessionPlural: string;

  static from(category: BusinessCategory): CategoryLexiconResponseDto {
    return { ...categoryLexicon(category) };
  }
}
