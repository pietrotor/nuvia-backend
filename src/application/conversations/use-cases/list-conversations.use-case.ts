import { Inject, Injectable } from '@nestjs/common';

import { PaginationDto } from '@application/common/dto/pagination.dto';
import {
  CONVERSATION_VIEW_REPOSITORY,
  ConversationListResult,
  ConversationViewRepository,
} from '@domain/conversations/repositories/conversation-view.repository';

const DEFAULT_LIMIT = 20;

export interface ListConversationsResult extends ConversationListResult {
  limit: number;
  offset: number;
}

@Injectable()
export class ListConversationsUseCase {
  constructor(
    @Inject(CONVERSATION_VIEW_REPOSITORY)
    private readonly conversationViewRepository: ConversationViewRepository,
  ) {}

  async execute(pagination: PaginationDto): Promise<ListConversationsResult> {
    const limit = pagination.limit ?? DEFAULT_LIMIT;
    const offset = pagination.offset ?? 0;
    const result = await this.conversationViewRepository.list({
      limit,
      offset,
    });

    return { ...result, limit, offset };
  }
}
