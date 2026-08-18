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

import {
  AgentEconomicsQueryDto,
  AgentTracesTenantOnlyQueryDto,
  AgentTracesTenantQueryDto,
  PruneAgentTracesDto,
} from '@application/agent/dto/agent-traces-query.dto';
import { GetAgentEconomicsUseCase } from '@application/agent/use-cases/get-agent-economics.use-case';
import { GetAgentTraceUseCase } from '@application/agent/use-cases/get-agent-trace.use-case';
import { GetConversationTraceThreadUseCase } from '@application/agent/use-cases/get-conversation-trace-thread.use-case';
import { ListTracedConversationsUseCase } from '@application/agent/use-cases/list-traced-conversations.use-case';
import { PruneAgentTracesUseCase } from '@application/agent/use-cases/prune-agent-traces.use-case';
import { Permission } from '@domain/users/value-objects/permission.vo';
import { Auth } from '@interface/http/common/decorators/auth.decorator';
import { PaginatedResponseDto } from '@interface/http/common/dto/paginated-response.dto';
import {
  AgentEconomicsResponseDto,
  AgentTraceDetailResponseDto,
  AgentTracedConversationResponseDto,
  ConversationTraceThreadResponseDto,
  PruneAgentTracesResponseDto,
} from './dto/agent-trace-response.dto';

@ApiTags('Admin')
@ApiBearerAuth()
@Controller('admin/agent-traces')
export class AgentTracesController {
  constructor(
    private readonly listTracedConversations: ListTracedConversationsUseCase,
    private readonly getConversationTraceThread: GetConversationTraceThreadUseCase,
    private readonly getAgentTrace: GetAgentTraceUseCase,
    private readonly getAgentEconomics: GetAgentEconomicsUseCase,
    private readonly pruneAgentTraces: PruneAgentTracesUseCase,
  ) {}

  @Get('economics')
  @Auth(Permission.AGENT_TRACES_READ)
  @ApiOperation({
    summary:
      'Summarizes LLM tokens and provider cost for a tenant over a period',
  })
  @ApiResponse({ status: 200, type: AgentEconomicsResponseDto })
  async economics(
    @Query() query: AgentEconomicsQueryDto,
  ): Promise<AgentEconomicsResponseDto> {
    return AgentEconomicsResponseDto.from(
      await this.getAgentEconomics.execute({
        tenantId: query.tenantId,
        from: new Date(query.from),
        to: new Date(query.to),
      }),
    );
  }

  @Get('conversations')
  @Auth(Permission.AGENT_TRACES_READ)
  @ApiOperation({
    summary: 'Lists conversations that have agent traces for a tenant',
  })
  @ApiResponse({ status: 200, type: PaginatedResponseDto })
  async conversations(
    @Query() query: AgentTracesTenantQueryDto,
  ): Promise<PaginatedResponseDto<AgentTracedConversationResponseDto>> {
    const result = await this.listTracedConversations.execute({
      tenantId: query.tenantId,
      limit: query.limit ?? 20,
      offset: query.offset ?? 0,
      search: query.search,
    });
    return PaginatedResponseDto.of(
      result.rows.map(AgentTracedConversationResponseDto.from),
      result.total,
      query.limit ?? 20,
      query.offset ?? 0,
    );
  }

  @Get('conversations/:conversationId')
  @Auth(Permission.AGENT_TRACES_READ)
  @ApiOperation({
    summary: 'Reads the message thread and agent turn summaries',
  })
  @ApiResponse({ status: 200, type: ConversationTraceThreadResponseDto })
  async thread(
    @Param('conversationId', ParseUUIDPipe) conversationId: string,
    @Query() query: AgentTracesTenantOnlyQueryDto,
  ): Promise<ConversationTraceThreadResponseDto> {
    return ConversationTraceThreadResponseDto.from(
      await this.getConversationTraceThread.execute({
        tenantId: query.tenantId,
        conversationId,
      }),
    );
  }

  @Get(':traceId')
  @Auth(Permission.AGENT_TRACES_READ)
  @ApiOperation({ summary: 'Reads one agent turn timeline in full' })
  @ApiResponse({ status: 200, type: AgentTraceDetailResponseDto })
  async detail(
    @Param('traceId', ParseUUIDPipe) traceId: string,
    @Query() query: AgentTracesTenantOnlyQueryDto,
  ): Promise<AgentTraceDetailResponseDto> {
    return AgentTraceDetailResponseDto.from(
      await this.getAgentTrace.execute({
        tenantId: query.tenantId,
        traceId,
      }),
    );
  }

  @Post('prune')
  @Auth(Permission.AGENT_TRACES_PRUNE)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Deletes agent traces older than N days' })
  @ApiResponse({ status: 200, type: PruneAgentTracesResponseDto })
  async prune(
    @Body() body: PruneAgentTracesDto,
  ): Promise<PruneAgentTracesResponseDto> {
    return PruneAgentTracesResponseDto.from(
      await this.pruneAgentTraces.execute(body),
    );
  }
}
