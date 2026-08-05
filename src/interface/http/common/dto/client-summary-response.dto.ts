import { ApiProperty } from '@nestjs/swagger';

import { ClientSummary } from '@domain/clients/views/client-summary';

export class ClientSummaryResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  name: string;

  @ApiProperty({ example: '+59171234567' })
  phoneE164: string;

  static from(client: ClientSummary): ClientSummaryResponseDto {
    return {
      id: client.id,
      name: client.name,
      phoneE164: client.phoneE164,
    };
  }
}
