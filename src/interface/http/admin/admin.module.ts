import { Module } from '@nestjs/common';

import { GetAgentEconomicsUseCase } from '@application/agent/use-cases/get-agent-economics.use-case';
import { GetAgentTraceUseCase } from '@application/agent/use-cases/get-agent-trace.use-case';
import { GetConversationTraceThreadUseCase } from '@application/agent/use-cases/get-conversation-trace-thread.use-case';
import { ListTracedConversationsUseCase } from '@application/agent/use-cases/list-traced-conversations.use-case';
import { PruneAgentTracesUseCase } from '@application/agent/use-cases/prune-agent-traces.use-case';
import { BackfillBranchesUseCase } from '@application/branches/use-cases/backfill-branches.use-case';
import { AdminController } from './admin.controller';
import { AgentTracesController } from './agent-traces.controller';
import { SubscriptionsAdminController } from './subscriptions-admin.controller';

@Module({
  controllers: [
    AdminController,
    SubscriptionsAdminController,
    AgentTracesController,
  ],
  providers: [
    BackfillBranchesUseCase,
    ListTracedConversationsUseCase,
    GetConversationTraceThreadUseCase,
    GetAgentTraceUseCase,
    GetAgentEconomicsUseCase,
    PruneAgentTracesUseCase,
  ],
})
export class AdminModule {}
