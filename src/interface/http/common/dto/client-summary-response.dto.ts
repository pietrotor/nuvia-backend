import { ApiProperty } from '@nestjs/swagger';

import { ClientSummary } from '@domain/clients/views/client-summary';

export class ClientSummaryResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty({ nullable: true })
  name: string | null;

  @ApiProperty({ example: '+59171234567', nullable: true })
  phoneE164: string | null;

  static from(client: ClientSummary): ClientSummaryResponseDto {
    return {
      id: client.id,
      name: client.name,
      phoneE164: client.phoneE164,
    };
  }
}
