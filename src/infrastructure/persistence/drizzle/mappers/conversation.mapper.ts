import { Conversation } from '@domain/conversations/entities/conversation.entity';
import {
  Message,
  MessageDirection,
  MessageKind,
} from '@domain/conversations/entities/message.entity';

import {
  ConversationSchema,
  MessageSchema,
} from '../schema/conversation.schema';

export class ConversationMapper {
  static toDomain(row: ConversationSchema): Conversation {
    return new Conversation({
      id: row.id,
      tenantId: row.tenantId,
      clientId: row.clientId,
      clientPhoneE164: row.clientPhoneE164,
      botPaused: row.botPaused,
      botPausedAt: row.botPausedAt,
      handoffReason: row.handoffReason,
      lastActivityAt: row.lastActivityAt,
    });
  }
}

export class MessageMapper {
  static toDomain(row: MessageSchema): Message {
    return new Message({
      ...row,
      direction: row.direction as MessageDirection,
      kind: row.kind as MessageKind,
    });
  }
}
