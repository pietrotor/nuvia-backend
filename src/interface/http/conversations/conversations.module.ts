import { Module } from '@nestjs/common';

import { ListConversationMessagesUseCase } from '@application/conversations/use-cases/list-conversation-messages.use-case';
import { ListConversationsUseCase } from '@application/conversations/use-cases/list-conversations.use-case';
import { PauseConversationBotUseCase } from '@application/conversations/use-cases/pause-conversation-bot.use-case';
import { ResumeConversationBotUseCase } from '@application/conversations/use-cases/resume-conversation-bot.use-case';
import { SendManualMessageUseCase } from '@application/conversations/use-cases/send-manual-message.use-case';
import { ConversationHandoffLabelService } from '@application/conversations/services/conversation-handoff-label.service';
import { ConversationsController } from './conversations.controller';

@Module({
  controllers: [ConversationsController],
  providers: [
    ListConversationsUseCase,
    ListConversationMessagesUseCase,
    PauseConversationBotUseCase,
    ResumeConversationBotUseCase,
    SendManualMessageUseCase,
    ConversationHandoffLabelService,
  ],
})
export class ConversationsModule {}
