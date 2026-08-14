import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

import { Client } from '@domain/clients/entities/client.entity';

export class ClientResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  name: string;

  @ApiProperty({ example: '+59171234567' })
  phoneE164: string;

  @ApiPropertyOptional({ nullable: true })
  email: string | null;

  @ApiPropertyOptional({ nullable: true, example: '1992-08-14' })
  birthDate: string | null;

  @ApiPropertyOptional({ nullable: true, example: 'CI' })
  identificationType: string | null;

  @ApiPropertyOptional({ nullable: true, example: '1234567 CB' })
  identificationNumber: string | null;

  @ApiPropertyOptional({ nullable: true })
  address: string | null;

  @ApiPropertyOptional({ nullable: true })
  notes: string | null;

  static from(client: Client): ClientResponseDto {
    return {
      id: client.id,
      name: client.name,
      phoneE164: client.phoneE164,
      email: client.email,
      birthDate: client.birthDate,
      identificationType: client.identificationType,
      identificationNumber: client.identificationNumber,
      address: client.address,
      notes: client.notes,
    };
  }
}
