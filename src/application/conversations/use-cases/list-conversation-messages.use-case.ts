import { Inject, Injectable } from '@nestjs/common';

import { PaginationDto } from '@application/common/dto/pagination.dto';
import { Message } from '@domain/conversations/entities/message.entity';
import { ConversationNotFoundError } from '@domain/conversations/exceptions/conversation.exceptions';
import {
  CONVERSATION_REPOSITORY,
  ConversationRepository,
} from '@domain/conversations/repositories/conversation.repository';
import {
  MESSAGE_REPOSITORY,
  MessageRepository,
} from '@domain/conversations/repositories/message.repository';

const DEFAULT_LIMIT = 50;

@Injectable()
export class ListConversationMessagesUseCase {
  constructor(
    @Inject(CONVERSATION_REPOSITORY)
    private readonly conversationRepository: ConversationRepository,
    @Inject(MESSAGE_REPOSITORY)
    private readonly messageRepository: MessageRepository,
  ) {}

  async execute(
    conversationId: string,
    pagination: PaginationDto,
  ): Promise<Message[]> {
    const conversation =
      await this.conversationRepository.findById(conversationId);
    if (!conversation) throw new ConversationNotFoundError(conversationId);

    return this.messageRepository.findByConversation(conversation.id, {
      limit: pagination.limit ?? DEFAULT_LIMIT,
      offset: pagination.offset ?? 0,
    });
  }
}
