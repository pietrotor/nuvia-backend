import { Inject, Injectable } from '@nestjs/common';

import { AuditRecorder } from '@application/audit/services/audit-recorder.service';
import { AgendaEventPublisher } from '@application/realtime/services/agenda-event.publisher';
import { AppointmentReminderPublisher } from '@application/reminders/services/appointment-reminder.publisher';
import { Appointment } from '@domain/appointments/entities/appointment.entity';
import { AppointmentNotFoundError } from '@domain/appointments/exceptions/appointment.exceptions';
import {
  APPOINTMENT_REPOSITORY,
  AppointmentRepository,
} from '@domain/appointments/repositories/appointment.repository';
import { AuditAction } from '@domain/audit/entities/audit-log.entity';
import {
  CLIENT_REPOSITORY,
  ClientRepository,
} from '@domain/clients/repositories/client.repository';
import { TenantContextMissingError } from '@domain/common/exceptions';
import { CLOCK_PORT, ClockPort } from '@domain/common/ports/clock.port';
import { LOGGER_PORT, LoggerPort } from '@domain/common/ports/logger.port';
import {
  TRANSACTION_PORT,
  TransactionPort,
} from '@domain/common/ports/transaction.port';
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
import {
  MESSAGING_PORT,
  MessagingPort,
  OutboundClass,
} from '@domain/messaging/ports/messaging.port';
import {
  TENANT_CONTEXT_PORT,
  TenantContextPort,
} from '@domain/tenants/ports/tenant-context.port';
import { DepositOutboundCopy } from '../messages/deposit-outbound.copy';

@Injectable()
export class VerifyDepositUseCase {
  constructor(
    @Inject(APPOINTMENT_REPOSITORY)
    private readonly appointments: AppointmentRepository,
    @Inject(CLIENT_REPOSITORY)
    private readonly clients: ClientRepository,
    @Inject(CONVERSATION_REPOSITORY)
    private readonly conversations: ConversationRepository,
    @Inject(MESSAGE_REPOSITORY)
    private readonly messages: MessageRepository,
    @Inject(MESSAGING_PORT)
    private readonly messaging: MessagingPort,
    @Inject(CLOCK_PORT)
    private readonly clock: ClockPort,
    @Inject(TENANT_CONTEXT_PORT)
    private readonly tenantContext: TenantContextPort,
    @Inject(TRANSACTION_PORT)
    private readonly transactions: TransactionPort,
    @Inject(LOGGER_PORT)
    private readonly logger: LoggerPort,
    private readonly reminders: AppointmentReminderPublisher,
    private readonly audit: AuditRecorder,
    private readonly agendaEvents: AgendaEventPublisher,
  ) {}

  async execute(appointmentId: string): Promise<Appointment> {
    const verifierId = this.tenantContext.userId;
    if (!verifierId) {
      throw new TenantContextMissingError(VerifyDepositUseCase.name);
    }
    const result = await this.transactions.run(async () => {
      const current = await this.appointments.findById(appointmentId);
      if (!current) throw new AppointmentNotFoundError(appointmentId);
      const candidate = current.confirmDeposit({
        verifiedAt: this.clock.now(),
        verifiedByUserId: verifierId,
      });
      const confirmed =
        await this.appointments.saveDepositConfirmation(candidate);
      if (!confirmed) {
        const fresh = await this.appointments.findById(appointmentId);
        if (!fresh) throw new AppointmentNotFoundError(appointmentId);
        fresh.confirmDeposit({
          verifiedAt: this.clock.now(),
          verifiedByUserId: verifierId,
        });
        throw new Error('Deposit confirmation could not be persisted');
      }
      await this.reminders.syncPreVisit(confirmed);
      return { current, confirmed };
    });
    const appointment = result.confirmed;

    await this.audit.record({
      action: AuditAction.DEPOSIT_VERIFIED,
      entity: 'appointment',
      entityId: appointment.id,
      before: { status: result.current.status },
      after: {
        status: appointment.status,
        verifiedAt: appointment.depositVerifiedAt,
      },
    });
    await this.agendaEvents.changed();
    await this.notifyClient(appointment);
    return appointment;
  }

  private async notifyClient(appointment: Appointment): Promise<void> {
    try {
      const client = await this.clients.findById(
        appointment.bookingContactClientId,
      );
      if (!client?.phoneE164) return;
      const conversation = await this.conversations.findByClientPhone(
        client.phoneE164,
      );
      if (!conversation) return;
      const text = DepositOutboundCopy.depositVerified;
      const sent = await this.messaging.sendText({
        tenantId: appointment.tenantId,
        toE164: client.phoneE164,
        text,
        outboundClass: OutboundClass.TRANSACTIONAL,
      });
      await this.messages.recordIfNew({
        conversationId: conversation.id,
        providerMessageId: sent.providerMessageId,
        direction: MessageDirection.OUTBOUND,
        kind: MessageKind.TEXT,
        content: text,
        occurredAt: this.clock.now(),
      });
    } catch (error) {
      this.logger.warn(
        `Deposit ${appointment.id} was verified but its client notification failed: ${error instanceof Error ? error.message : String(error)}`,
        VerifyDepositUseCase.name,
      );
    }
  }
}
