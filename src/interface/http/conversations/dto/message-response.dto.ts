import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

import {
  Message,
  MessageDirection,
  MessageKind,
} from '@domain/conversations/entities/message.entity';

export class MessageResponseDto {
  @ApiProperty()
  id: string;

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
      direction: message.direction,
      kind: message.kind,
      content: message.content,
      occurredAt: message.occurredAt.toISOString(),
    };
  }
}
