import { Inject, Injectable } from '@nestjs/common';

import {
  CLIENT_REPOSITORY,
  ClientRepository,
} from '@domain/clients/repositories/client.repository';
import {
  MessageDirection,
  MessageKind,
} from '@domain/conversations/entities/message.entity';
import {
  CONVERSATION_REPOSITORY,
  ConversationRepository,
} from '@domain/conversations/repositories/conversation.repository';
import {
  MESSAGE_REPOSITORY,
  MessageRepository,
} from '@domain/conversations/repositories/message.repository';

export interface RecordInboundMessageInput {
  providerMessageId: string;
  clientPhoneE164: string;
  clientName: string;
  kind: MessageKind;
  content: string | null;
  occurredAt: Date;
}

export interface RecordedInboundMessage {
  clientId: string;
  conversationId: string;
  needsReply: boolean;
}

// Storing the message is kept apart from answering it so the conversation is
// complete before the agent reads it: when a client sends three messages in a
// row, the reply that runs last sees all three.
@Injectable()
export class RecordInboundMessageUseCase {
  constructor(
    @Inject(CLIENT_REPOSITORY)
    private readonly clients: ClientRepository,
    @Inject(CONVERSATION_REPOSITORY)
    private readonly conversations: ConversationRepository,
    @Inject(MESSAGE_REPOSITORY)
    private readonly messages: MessageRepository,
  ) {}

  async execute(
    input: RecordInboundMessageInput,
  ): Promise<RecordedInboundMessage> {
    const client = await this.clients.findOrCreate({
      name: input.clientName,
      phoneE164: input.clientPhoneE164,
    });
    const conversation = await this.conversations.findOrCreate({
      clientId: client.id,
      clientPhoneE164: input.clientPhoneE164,
      occurredAt: input.occurredAt,
    });
    const recorded = await this.messages.recordIfNew({
      conversationId: conversation.id,
      providerMessageId: input.providerMessageId,
      direction: MessageDirection.INBOUND,
      kind: input.kind,
      content: input.content,
      occurredAt: input.occurredAt,
    });

    return {
      clientId: client.id,
      conversationId: conversation.id,
      // A webhook the provider repeats must not queue a second answer.
      needsReply:
        Boolean(recorded) ||
        !(await this.messages.hasReplyTo(input.providerMessageId)),
    };
  }
}
