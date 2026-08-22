import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

import { Client } from '@domain/clients/entities/client.entity';

export class ClientResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty({ nullable: true })
  name: string | null;

  @ApiProperty({ example: '+59171234567', nullable: true })
  phoneE164: string | null;

  @ApiPropertyOptional({
    nullable: true,
    description:
      'WhatsApp pushName only. Never treat as the confirmed client name.',
  })
  whatsappProfileName: string | null;

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
      whatsappProfileName: client.whatsappProfileName,
      email: client.email,
      birthDate: client.birthDate,
      identificationType: client.identificationType,
      identificationNumber: client.identificationNumber,
      address: client.address,
      notes: client.notes,
    };
  }
}
