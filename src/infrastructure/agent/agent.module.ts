import { Module } from '@nestjs/common';

import { AgentOrchestrator } from '@application/agent/services/agent-orchestrator.service';
import { AgentPromptComposer } from '@application/agent/services/agent-prompt.composer';
import { AgentToolRegistry } from '@application/agent/services/agent-tool.registry';
import { AGENT_TOOLS, AgentTool } from '@application/agent/tools/agent-tool';
import { BookAppointmentAgentTool } from '@application/agent/tools/book-appointment.agent-tool';
import { CancelAppointmentAgentTool } from '@application/agent/tools/cancel-appointment.agent-tool';
import { ConfirmClientNameAgentTool } from '@application/agent/tools/confirm-client-name.agent-tool';
import { FindAvailabilityAgentTool } from '@application/agent/tools/find-availability.agent-tool';
import { GetBusinessInfoAgentTool } from '@application/agent/tools/get-business-info.agent-tool';
import { ListBookingAttendeesAgentTool } from '@application/agent/tools/list-booking-attendees.agent-tool';
import { ListBranchesAgentTool } from '@application/agent/tools/list-branches.agent-tool';
import { ListMyAppointmentsAgentTool } from '@application/agent/tools/list-my-appointments.agent-tool';
import { ListProfessionalsAgentTool } from '@application/agent/tools/list-professionals.agent-tool';
import { ListServicesAgentTool } from '@application/agent/tools/list-services.agent-tool';
import { RequestHandoffAgentTool } from '@application/agent/tools/request-handoff.agent-tool';
import { ResendDepositQrAgentTool } from '@application/agent/tools/resend-deposit-qr.agent-tool';
import { RescheduleAppointmentAgentTool } from '@application/agent/tools/reschedule-appointment.agent-tool';
import { SetBranchAgentTool } from '@application/agent/tools/set-branch.agent-tool';
import { AssignDepositReceiptAgentTool } from '@application/agent/tools/assign-deposit-receipt.agent-tool';
import { ExpectDepositReceiptAgentTool } from '@application/agent/tools/expect-deposit-receipt.agent-tool';
import { RecordInboundMessageUseCase } from '@application/agent/use-cases/record-inbound-message.use-case';
import { ReplyToConversationUseCase } from '@application/agent/use-cases/reply-to-conversation.use-case';
import { ConversationHandoffLabelService } from '@application/conversations/services/conversation-handoff-label.service';
import { DepositsApplicationModule } from '@application/deposits/deposits-application.module';
import { PROMPT_CATALOG_PORT } from '@domain/agent/ports/prompt-catalog.port';
import { StaticPromptCatalogAdapter } from './prompts/static-prompt-catalog.adapter';
import { ClientsModule } from '@interface/http/clients/clients.module';
import { AppointmentsModule } from '@interface/http/appointments/appointments.module';
import { BranchesModule } from '@interface/http/branches/branches.module';
import { BusinessConfigModule } from '@interface/http/business-config/business-config.module';
import { ServicesModule } from '@interface/http/services/services.module';
import { ProfessionalsModule } from '@interface/http/professionals/professionals.module';

const tools = [
  ListBranchesAgentTool,
  SetBranchAgentTool,
  ListServicesAgentTool,
  ListProfessionalsAgentTool,
  GetBusinessInfoAgentTool,
  FindAvailabilityAgentTool,
  ConfirmClientNameAgentTool,
  ListBookingAttendeesAgentTool,
  BookAppointmentAgentTool,
  ListMyAppointmentsAgentTool,
  RescheduleAppointmentAgentTool,
  CancelAppointmentAgentTool,
  ResendDepositQrAgentTool,
  AssignDepositReceiptAgentTool,
  ExpectDepositReceiptAgentTool,
  RequestHandoffAgentTool,
];

@Module({
  imports: [
    AppointmentsModule,
    BranchesModule,
    BusinessConfigModule,
    DepositsApplicationModule,
    ProfessionalsModule,
    ServicesModule,
    ClientsModule,
  ],
  providers: [
    ...tools,
    {
      provide: AGENT_TOOLS,
      inject: tools,
      useFactory: (...agentTools: AgentTool[]) => agentTools,
    },
    {
      provide: PROMPT_CATALOG_PORT,
      useClass: StaticPromptCatalogAdapter,
    },
    AgentToolRegistry,
    AgentPromptComposer,
    AgentOrchestrator,
    ConversationHandoffLabelService,
    RecordInboundMessageUseCase,
    ReplyToConversationUseCase,
  ],
  exports: [RecordInboundMessageUseCase, ReplyToConversationUseCase],
})
export class AgentModule {}
