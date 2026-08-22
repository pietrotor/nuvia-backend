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

  @ApiPropertyOptional({ enum: MessageKind, nullable: true })
  quotedKind: MessageKind | null;

  @ApiPropertyOptional({ nullable: true })
  quotedContent: string | null;

  @ApiProperty({ enum: MessageDirection })
  direction: MessageDirection;

  @ApiProperty({ enum: MessageKind })
  kind: MessageKind;

  @ApiPropertyOptional({ nullable: true })
  content: string | null;

  @ApiProperty()
  occurredAt: string;

  static from(
    message: Message,
    quotedMessage: Message | null = null,
  ): MessageResponseDto {
    return {
      id: message.id,
      providerMessageId: message.providerMessageId,
      inReplyToProviderMessageId: message.inReplyToProviderMessageId,
      quotedKind: quotedMessage?.kind ?? null,
      quotedContent: quotedMessage?.content ?? null,
      direction: message.direction,
      kind: message.kind,
      content: message.content,
      occurredAt: message.occurredAt.toISOString(),
    };
  }
}
