import { Inject, Injectable } from '@nestjs/common';

import { PaginationDto } from '@application/common/dto/pagination.dto';
import {
  CONVERSATION_VIEW_REPOSITORY,
  ConversationView,
  ConversationViewRepository,
} from '@domain/conversations/repositories/conversation-view.repository';

const DEFAULT_LIMIT = 20;

@Injectable()
export class ListConversationsUseCase {
  constructor(
    @Inject(CONVERSATION_VIEW_REPOSITORY)
    private readonly conversationViewRepository: ConversationViewRepository,
  ) {}

  async execute(pagination: PaginationDto): Promise<ConversationView[]> {
    return this.conversationViewRepository.list({
      limit: pagination.limit ?? DEFAULT_LIMIT,
      offset: pagination.offset ?? 0,
    });
  }
}
