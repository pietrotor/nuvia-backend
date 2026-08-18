import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

import {
  Message,
  MessageDirection,
  MessageKind,
} from '@domain/conversations/entities/message.entity';

export class MessageResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  providerMessageId: string;

  @ApiPropertyOptional({ nullable: true })
  inReplyToProviderMessageId: string | null;

  @ApiProperty({ enum: MessageDirection })
  direction: MessageDirection;

  @ApiProperty({ enum: MessageKind })
  kind: MessageKind;

  @ApiPropertyOptional({ nullable: true })
  content: string | null;

  @ApiProperty()
  occurredAt: string;

  static from(message: Message): MessageResponseDto {
    return {
      id: message.id,
      providerMessageId: message.providerMessageId,
      inReplyToProviderMessageId: message.inReplyToProviderMessageId,
      direction: message.direction,
      kind: message.kind,
      content: message.content,
      occurredAt: message.occurredAt.toISOString(),
    };
  }
}
