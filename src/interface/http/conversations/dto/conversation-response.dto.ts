import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

import { ClientSummary } from '@domain/clients/views/client-summary';
import {
  Conversation,
  ConversationAttentionState,
} from '@domain/conversations/entities/conversation.entity';
import { ClientSummaryResponseDto } from '@interface/http/common/dto/client-summary-response.dto';

export class ConversationResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  clientPhoneE164: string;

  @ApiProperty()
  botPaused: boolean;

  @ApiPropertyOptional({ nullable: true, type: String, format: 'date-time' })
  botPausedAt: string | null;

  @ApiPropertyOptional({ nullable: true })
  handoffReason: string | null;

  @ApiProperty({ description: 'Escalated conversation waiting for a person' })
  needsAttention: boolean;

  @ApiProperty({ enum: ConversationAttentionState })
  attentionState: ConversationAttentionState;

  @ApiProperty()
  lastActivityAt: string;

  @ApiPropertyOptional({
    type: ClientSummaryResponseDto,
    nullable: true,
    description:
      'Client of the conversation; the listing returns it already resolved. Null when the client is not registered yet.',
  })
  client: ClientSummaryResponseDto | null;

  static from(
    conversation: Conversation,
    client: ClientSummary | null = null,
  ): ConversationResponseDto {
    return {
      id: conversation.id,
      clientPhoneE164: conversation.clientPhoneE164,
      botPaused: conversation.botPaused,
      botPausedAt: conversation.botPausedAt?.toISOString() ?? null,
      handoffReason: conversation.handoffReason,
      needsAttention: conversation.needsAttention(),
      attentionState: conversation.attentionState(),
      lastActivityAt: conversation.lastActivityAt.toISOString(),
      client: client ? ClientSummaryResponseDto.from(client) : null,
    };
  }
}
