import { Inject, Injectable } from '@nestjs/common';

import { ListClientAppointmentsUseCase } from '@application/appointments/use-cases/list-client-appointments.use-case';
import { GetBusinessConfigUseCase } from '@application/business-config/use-cases/get-business-config.use-case';
import { AgentTracePhase } from '@domain/agent/entities/agent-trace.entity';
import {
  LLM_PORT,
  LlmMessage,
  LlmPort,
  LlmToolChoice,
} from '@domain/agent/ports/llm.port';
import {
  AGENT_TRACE_REPOSITORY,
  AgentTraceRepository,
} from '@domain/agent/repositories/agent-trace.repository';
import { PromptChannel } from '@domain/agent/prompt/prompt-fragment';
import {
  clockTimes,
  unofferedTimes,
} from '@domain/agent/services/offered-times';
import {
  DEPOSIT_QR_QUEUED,
  OutboundClaim,
  unsupportedClaims,
} from '@domain/agent/services/outbound-claim';
import {
  BRANCH_REPOSITORY,
  BranchRepository,
} from '@domain/branches/repositories/branch.repository';
import { CLOCK_PORT, ClockPort } from '@domain/common/ports/clock.port';
import { LOGGER_PORT, LoggerPort } from '@domain/common/ports/logger.port';
import {
  Message,
  MessageDirection,
  MessageKind,
} from '@domain/conversations/entities/message.entity';
import {
  CONVERSATION_REPOSITORY,
  ConversationRepository,
} from '@domain/conversations/repositories/conversation.repository';
import {
  TENANT_REPOSITORY,
  TenantRepository,
} from '@domain/tenants/repositories/tenant.repository';
import { AgentOutboundCopy } from '../messages/agent-outbound.copy';
import { toWhatsAppText } from '../messages/whatsapp-text';
import {
  AgentContext,
  AgentFollowUp,
  AgentToolResult,
  InboundAgentContext,
} from '../tools/agent-tool';
import { AgentPromptComposer } from './agent-prompt.composer';
import { AgentToolRegistry } from './agent-tool.registry';
import { AgentTraceDraft } from './agent-trace.draft';
import { projectToolResultForModel } from './project-tool-result-for-model';

const MAX_TOOL_ROUNDS = 5;
const FALLBACK_TIMEZONE = 'America/La_Paz';

// Sent back to the model when it announced an action it never took. Written as if the
// client could not see it, because she cannot: it only exists inside this round.
const CLAIM_CORRECTION =
  'Tu último mensaje da por hecha una acción que no ejecutaste: no llamaste a la herramienta que la realiza, así que para el sistema no ocurrió. Ejecutá ahora la herramienta correspondiente. Si no se puede (el horario no está libre, faltan datos, la herramienta falla), no la fuerces: derivá con request_handoff.';

// Sent back when the answer names hours the agenda never returned. Spelling out the ones
// it may use turns the rewrite into a copy, instead of another guess.
function scheduleCorrection(offerable: readonly string[]): string {
  const allowed = [...new Set(offerable.flatMap(clockTimes))].sort();

  if (allowed.length === 0) {
    return 'Tu último mensaje nombra horas exactas, pero la herramienta devolvió solamente días y franjas. Reescribilo sin ninguna hora: mostrale los días y franjas disponibles y preguntá cuál prefiere.';
  }

  return `Tu último mensaje nombra horarios que ninguna herramienta devolvió: los completaste vos. Los únicos que podés nombrar ahora son ${allowed.join(', ')}. Reescribilo copiando únicamente los rangos y horas aisladas que devolvió find_availability, sin desglosar franjas ni agregar muestras propias.`;
}

export interface AgentRespondTrigger {
  providerMessageId: string;
  text: string | null;
}

export interface AgentResponse {
  text: string;
  // Which prompt produced this answer: stored with the outbound message.
  promptFingerprint: string;
  // Outbounds the tools decided are due, sent after this answer.
  followUps: AgentFollowUp[];
}

// Everything the tool loop accumulates across rounds, including the retry.
interface AgentSession {
  messages: LlmMessage[];
  followUps: AgentFollowUp[];
  // What actually happened this turn, which is what the answer is checked against.
  evidence: string[];
  // Every clock time the tools put on the table this turn.
  offerableTimes: string[];
}

@Injectable()
export class AgentOrchestrator {
  constructor(
    @Inject(LLM_PORT) private readonly llm: LlmPort,
    private readonly getBusinessConfig: GetBusinessConfigUseCase,
    private readonly tools: AgentToolRegistry,
    @Inject(TENANT_REPOSITORY)
    private readonly tenants: TenantRepository,
    @Inject(CONVERSATION_REPOSITORY)
    private readonly conversations: ConversationRepository,
    @Inject(BRANCH_REPOSITORY)
    private readonly branches: BranchRepository,
    private readonly listClientAppointments: ListClientAppointmentsUseCase,
    @Inject(CLOCK_PORT)
    private readonly clock: ClockPort,
    private readonly promptComposer: AgentPromptComposer,
    @Inject(LOGGER_PORT)
    private readonly logger: LoggerPort,
    @Inject(AGENT_TRACE_REPOSITORY)
    private readonly traces: AgentTraceRepository,
  ) {}

  async respond(
    history: Message[],
    inbound: InboundAgentContext,
    trigger: AgentRespondTrigger,
  ): Promise<AgentResponse> {
    const draft = new AgentTraceDraft({
      tenantId: inbound.tenantId,
      conversationId: inbound.conversationId,
      triggerProviderMessageId: trigger.providerMessageId,
      inboundText: trigger.text,
      startedAt: this.clock.now(),
    });

    try {
      const response = await this.runTurn(history, inbound, trigger, draft);
      await this.persistTrace(
        draft.finish({
          text: response.text,
          endedAt: this.clock.now(),
        }),
      );
      return response;
    } catch (error) {
      await this.persistTrace(draft.fail({ error, endedAt: this.clock.now() }));
      throw error;
    }
  }

  private async runTurn(
    history: Message[],
    inbound: InboundAgentContext,
    trigger: AgentRespondTrigger,
    draft: AgentTraceDraft,
  ): Promise<AgentResponse> {
    const config = await this.getBusinessConfig.execute();
    const tenant = await this.tenants.findById(config.tenantId);
    const timezone = tenant?.timezone ?? FALLBACK_TIMEZONE;
    const branchId = await this.resolveBranchId(inbound);
    const triggerMessage = history.find(
      (message) => message.providerMessageId === trigger.providerMessageId,
    );
    const context: AgentContext = {
      ...inbound,
      timezone,
      branchId,
      quotedProviderMessageId:
        triggerMessage?.inReplyToProviderMessageId ?? null,
    };
    const prompt = await this.promptComposer.compose({
      config,
      timezone,
      channel: PromptChannel.WHATSAPP,
      now: this.clock.now(),
      clientId: context.clientId,
      branchId,
    });
    draft.setPrompt(prompt);

    const session: AgentSession = {
      messages: [
        { role: 'system', content: prompt.staticText, cacheable: true },
        { role: 'system', content: prompt.volatileText },
        ...history.map<LlmMessage>((message) => ({
          role:
            message.direction === MessageDirection.INBOUND
              ? 'user'
              : 'assistant',
          content: this.messageForModel(message, history),
        })),
      ],
      followUps: [],
      evidence: [],
      // Naming a clock time the client just wrote is not inventing one. Without this the
      // offered-times guard forced a rewrite every time the agent said "las 16:00 no
      // están libres".
      offerableTimes: trigger.text ? clockTimes(trigger.text) : [],
    };

    const answer = await this.answerWithTools(
      session,
      context,
      draft,
      'initial',
    );
    const claimed = await this.verifyClaims(answer, session, context, draft);
    const text = await this.verifyOfferedTimes(
      claimed,
      session,
      context,
      draft,
    );

    return {
      text: toWhatsAppText(text),
      promptFingerprint: prompt.fingerprint,
      followUps: session.followUps,
    };
  }

  private messageForModel(message: Message, history: Message[]): string {
    const content = this.modelMessageContent(message);
    // Every outbound row carries the inbound it answers, for idempotency. Only a
    // client who quoted a message in WhatsApp is really replying to something, and
    // prefixing our own turns taught the model to open its answers the same way.
    if (
      message.direction !== MessageDirection.INBOUND ||
      !message.inReplyToProviderMessageId
    ) {
      return content;
    }

    const quoted = history.find(
      (candidate) =>
        candidate.providerMessageId === message.inReplyToProviderMessageId,
    );
    const quotedContent = quoted
      ? this.modelMessageContent(quoted)
      : 'mensaje anterior no disponible';
    return `Respondiendo a: ${quotedContent.slice(0, 180)}\n${content}`;
  }

  private modelMessageContent(message: Message): string {
    const notes: string[] = [];
    if (message.kind === MessageKind.IMAGE) {
      notes.push(`referencia de imagen: ${message.providerMessageId}`);
    }
    if (message.relatedAppointmentId) {
      notes.push(`cita vinculada: ${message.relatedAppointmentId}`);
    }

    const body =
      message.content ??
      (message.kind === MessageKind.IMAGE
        ? 'Imagen/comprobante'
        : `[${message.kind}]`);
    return notes.length > 0 ? `${body} [${notes.join('; ')}]` : body;
  }

  // Pin a branch when the conversation already has one, the client has an upcoming
  // appointment at one, or the tenant only has a single active location.
  private async resolveBranchId(
    inbound: InboundAgentContext,
  ): Promise<string | null> {
    const conversation = await this.conversations.findById(
      inbound.conversationId,
    );
    if (conversation?.branchId) {
      return conversation.branchId;
    }

    const upcoming = await this.listClientAppointments.execute({
      clientId: inbound.clientId,
      onlyUpcoming: true,
      scope: 'managed',
    });
    const fromAppointment = upcoming.find(
      (view) => view.appointment.branchId !== null,
    )?.appointment.branchId;
    if (fromAppointment) {
      await this.conversations.setBranch(
        inbound.conversationId,
        fromAppointment,
      );
      return fromAppointment;
    }

    const active = await this.branches.findActive();
    if (active.length === 1) {
      await this.conversations.setBranch(inbound.conversationId, active[0].id);
      return active[0].id;
    }

    return null;
  }

  // An answer that announces a booking or a QR is only allowed out if the tool that
  // performs it actually ran. Otherwise the model gets one round where it cannot reply in
  // prose, so it either does the thing or hands off.
  private async verifyClaims(
    answer: string,
    session: AgentSession,
    context: AgentContext,
    draft: AgentTraceDraft,
  ): Promise<string> {
    const claims = unsupportedClaims(answer, session.evidence);
    if (claims.length === 0) return answer;

    this.logger.warn(
      `Answer claimed ${claims.join(', ')} with no tool to back it in conversation ${context.conversationId}: forcing a tool round`,
      AgentOrchestrator.name,
    );
    draft.recordGuard({
      guard: 'claims',
      detected: claims,
      action: 'retry',
    });

    session.messages.push({ role: 'assistant', content: answer });
    session.messages.push({ role: 'user', content: CLAIM_CORRECTION });

    const retried = await this.answerWithTools(
      session,
      context,
      draft,
      'claim_retry',
      'any',
    );
    const stillUnsupported = unsupportedClaims(retried, session.evidence);
    if (stillUnsupported.length === 0) return retried;

    this.logger.error(
      `Answer still claimed ${stillUnsupported.join(', ')} after the forced round in conversation ${context.conversationId}: handing off`,
      undefined,
      AgentOrchestrator.name,
    );
    draft.recordGuard({
      guard: 'claims',
      detected: stillUnsupported,
      action: 'handoff',
    });
    draft.setPendingOutcome('handoff_claims');
    await this.executeTool(
      'request_handoff',
      JSON.stringify({ reason: `unverified_${stillUnsupported.join('_')}` }),
      context,
      draft,
      0,
    );

    return stillUnsupported.includes(OutboundClaim.BOOKING)
      ? AgentOutboundCopy.unverifiedBooking
      : AgentOutboundCopy.unverifiedDepositQr;
  }

  // The agenda is the only place hours come from. When the answer names a time no tool
  // returned, the model is reading a free window as a list and writing it out slot by
  // slot, so it gets one round to rewrite with the times it was actually given.
  private async verifyOfferedTimes(
    answer: string,
    session: AgentSession,
    context: AgentContext,
    draft: AgentTraceDraft,
  ): Promise<string> {
    const invented = unofferedTimes(answer, session.offerableTimes);
    if (invented.length === 0) return answer;

    this.logger.warn(
      `Answer offered ${invented.join(', ')}, which no tool returned, in conversation ${context.conversationId}: asking for a rewrite`,
      AgentOrchestrator.name,
    );
    draft.recordGuard({
      guard: 'offered_times',
      detected: invented,
      action: 'retry',
    });

    session.messages.push({ role: 'assistant', content: answer });
    session.messages.push({
      role: 'user',
      content: scheduleCorrection(session.offerableTimes),
    });

    const retried = await this.answerWithTools(
      session,
      context,
      draft,
      'schedule_retry',
    );
    const stillInvented = unofferedTimes(retried, session.offerableTimes);
    if (stillInvented.length === 0) return retried;

    this.logger.error(
      `Answer still offered ${stillInvented.join(', ')} after the rewrite in conversation ${context.conversationId}: handing off`,
      undefined,
      AgentOrchestrator.name,
    );
    draft.recordGuard({
      guard: 'offered_times',
      detected: stillInvented,
      action: 'handoff',
    });
    draft.setPendingOutcome('handoff_schedule');
    await this.executeTool(
      'request_handoff',
      JSON.stringify({ reason: 'invented_schedule' }),
      context,
      draft,
      0,
    );

    return AgentOutboundCopy.unverifiedSchedule;
  }

  // `firstChoice` is 'any' only on the corrective round: the provider then prefills the
  // assistant turn, so the model cannot answer in prose until a tool has run. Later rounds
  // go back to 'auto' so it can write the reply.
  private async answerWithTools(
    session: AgentSession,
    context: AgentContext,
    draft: AgentTraceDraft,
    phase: AgentTracePhase,
    firstChoice: LlmToolChoice = 'auto',
  ): Promise<string> {
    for (let round = 0; round < MAX_TOOL_ROUNDS; round += 1) {
      const toolChoice = round === 0 ? firstChoice : 'auto';
      draft.recordLlmRequest({
        round,
        phase,
        toolChoice,
        messages: session.messages,
      });

      const startedAt = this.clock.now().getTime();
      const result = await this.llm.chat({
        messages: session.messages,
        tools: this.tools.definitions(),
        toolChoice,
        sessionId: context.conversationId,
      });
      draft.recordLlmResponse({
        round,
        phase,
        content: result.content,
        toolCalls: result.toolCalls,
        latencyMs: this.clock.now().getTime() - startedAt,
        model: result.model,
        usage: result.usage,
        finishReason: result.finishReason,
      });

      if (result.toolCalls.length === 0) {
        return (
          result.content?.trim() || AgentOutboundCopy.incompleteConsultation
        );
      }

      session.messages.push({
        role: 'assistant',
        content: result.content ?? '',
        toolCalls: result.toolCalls,
      });
      for (const call of result.toolCalls) {
        const toolResult = await this.executeTool(
          call.name,
          call.arguments,
          context,
          draft,
          round,
        );
        if (toolResult.status === 'success') {
          session.evidence.push(call.name);
        } else {
          this.logger.warn(
            `Tool ${call.name} returned ${toolResult.status}: ${toolResult.summary}`,
            AgentOrchestrator.name,
          );
        }
        if (toolResult.offerableTimes?.length) {
          session.offerableTimes.push(...toolResult.offerableTimes);
        }
        if (toolResult.followUp) {
          session.followUps.push(toolResult.followUp);
          if (toolResult.followUp.kind === 'deposit_qr') {
            session.evidence.push(DEPOSIT_QR_QUEUED);
          }
        }
        session.messages.push({
          role: 'tool',
          name: call.name,
          toolCallId: call.id,
          // The follow-up is an instruction for us, not context for the model.
          content: JSON.stringify(
            projectToolResultForModel(call.name, toolResult),
          ),
        });
      }
    }

    draft.setPendingOutcome('max_rounds');
    return AgentOutboundCopy.needsHumanContinuation;
  }

  private async executeTool(
    name: string,
    rawArguments: string,
    context: AgentContext,
    draft: AgentTraceDraft,
    round: number,
  ): Promise<AgentToolResult> {
    const tool = this.tools.get(name);
    if (!tool) {
      const missing: AgentToolResult = {
        status: 'error',
        summary: `La herramienta ${name} no existe.`,
        nextActions: ['No repetir esta herramienta.'],
      };
      draft.recordToolCall({
        round,
        name,
        arguments: rawArguments,
        status: 'error',
        summary: missing.summary,
        nextActions: missing.nextActions,
        latencyMs: 0,
        error: 'tool_not_found',
      });
      return missing;
    }

    const startedAt = this.clock.now().getTime();
    try {
      const result = await tool.execute(JSON.parse(rawArguments), context);
      draft.recordToolCall({
        round,
        name,
        arguments: rawArguments,
        status: result.status,
        summary: result.summary,
        data: result.data,
        nextActions: result.nextActions,
        offerableTimes: result.offerableTimes,
        followUp: result.followUp,
        latencyMs: this.clock.now().getTime() - startedAt,
      });
      return result;
    } catch (error) {
      // The model only sees a generic failure, so without this the tool error is
      // lost and the conversation looks like the agent simply changed its mind.
      this.logger.error(
        `Tool ${name} failed for conversation ${context.conversationId} with arguments ${rawArguments}: ${
          error instanceof Error ? error.message : String(error)
        }`,
        error instanceof Error ? error.stack : undefined,
        AgentOrchestrator.name,
      );
      const failed: AgentToolResult = {
        status: 'error',
        summary: 'No se pudo ejecutar la acción solicitada.',
        nextActions: [
          'Revisar los datos y reintentar una vez.',
          'Derivar si el error persiste.',
        ],
      };
      draft.recordToolCall({
        round,
        name,
        arguments: rawArguments,
        status: 'error',
        summary: failed.summary,
        nextActions: failed.nextActions,
        latencyMs: this.clock.now().getTime() - startedAt,
        error: error instanceof Error ? error.message : String(error),
      });
      return failed;
    }
  }

  private async persistTrace(
    trace: Parameters<AgentTraceRepository['save']>[0],
  ): Promise<void> {
    try {
      await this.traces.save(trace);
    } catch (error) {
      this.logger.error(
        `Could not persist agent trace for conversation ${trace.conversationId}`,
        error instanceof Error ? error.stack : undefined,
        AgentOrchestrator.name,
      );
    }
  }
}
