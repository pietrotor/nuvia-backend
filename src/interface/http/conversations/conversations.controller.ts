import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';

import { PaginationDto } from '@application/common/dto/pagination.dto';
import { SendManualMessageDto } from '@application/conversations/dto/send-manual-message.dto';
import { ListConversationMessagesUseCase } from '@application/conversations/use-cases/list-conversation-messages.use-case';
import { ListConversationsUseCase } from '@application/conversations/use-cases/list-conversations.use-case';
import { PauseConversationBotUseCase } from '@application/conversations/use-cases/pause-conversation-bot.use-case';
import { ResumeConversationBotUseCase } from '@application/conversations/use-cases/resume-conversation-bot.use-case';
import { SendManualMessageUseCase } from '@application/conversations/use-cases/send-manual-message.use-case';
import { Role } from '@domain/users/value-objects/role.vo';
import { Auth } from '@interface/http/common/decorators/auth.decorator';
import { ConversationResponseDto } from './dto/conversation-response.dto';
import { MessageResponseDto } from './dto/message-response.dto';

@ApiTags('Conversations')
@ApiBearerAuth()
@Controller('conversations')
export class ConversationsController {
  constructor(
    private readonly listConversations: ListConversationsUseCase,
    private readonly listMessages: ListConversationMessagesUseCase,
    private readonly pauseBot: PauseConversationBotUseCase,
    private readonly resumeBot: ResumeConversationBotUseCase,
    private readonly sendManualMessage: SendManualMessageUseCase,
  ) {}

  @Get()
  @Auth(Role.OWNER, Role.STAFF)
  @ApiOperation({
    summary: 'Lists the WhatsApp conversation inbox, with the client',
  })
  @ApiResponse({ status: 200, type: [ConversationResponseDto] })
  async list(
    @Query() pagination: PaginationDto,
  ): Promise<ConversationResponseDto[]> {
    const views = await this.listConversations.execute(pagination);
    return views.map((view) =>
      ConversationResponseDto.from(view.conversation, view.client),
    );
  }

  @Get(':id/messages')
  @Auth(Role.OWNER, Role.STAFF)
  @ApiOperation({ summary: 'Reads the messages of a conversation' })
  @ApiResponse({ status: 200, type: [MessageResponseDto] })
  async messages(
    @Param('id', ParseUUIDPipe) id: string,
    @Query() pagination: PaginationDto,
  ): Promise<MessageResponseDto[]> {
    const messages = await this.listMessages.execute(id, pagination);
    return messages.map(MessageResponseDto.from);
  }

  @Post(':id/pause')
  @Auth(Role.OWNER, Role.STAFF)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Pauses the agent in this conversation' })
  @ApiResponse({ status: 200, type: ConversationResponseDto })
  async pause(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<ConversationResponseDto> {
    return ConversationResponseDto.from(await this.pauseBot.execute(id));
  }

  @Post(':id/resume')
  @Auth(Role.OWNER, Role.STAFF)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Resumes the agent and closes the handoff' })
  @ApiResponse({ status: 200, type: ConversationResponseDto })
  async resume(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<ConversationResponseDto> {
    return ConversationResponseDto.from(await this.resumeBot.execute(id));
  }

  @Post(':id/messages')
  @Auth(Role.OWNER, Role.STAFF)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Replies manually, as a person from the business',
    description:
      'Sends the message and pauses the agent in that conversation: the person stays in charge until the agent is resumed.',
  })
  @ApiResponse({ status: 201, type: MessageResponseDto })
  async reply(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SendManualMessageDto,
  ): Promise<MessageResponseDto> {
    return MessageResponseDto.from(
      await this.sendManualMessage.execute(id, dto),
    );
  }
}
