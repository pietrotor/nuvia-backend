import { ApiProperty } from '@nestjs/swagger';
import { IsEnum } from 'class-validator';

import { BusinessCategory } from '@domain/business-config/value-objects/business-category.vo';

export class ChangeBusinessCategoryDto {
  @ApiProperty({
    enum: BusinessCategory,
    example: BusinessCategory.ESTHETICS,
    description: 'Trade the agent of this business is set up for',
  })
  @IsEnum(BusinessCategory)
  businessCategory: BusinessCategory;
}
