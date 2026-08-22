import { Inject, Injectable } from '@nestjs/common';
import { DateTime } from 'luxon';

import {
  APPOINTMENT_VIEW_REPOSITORY,
  AppointmentView,
  AppointmentViewRepository,
} from '@domain/appointments/repositories/appointment-view.repository';
import { AppointmentStatus } from '@domain/appointments/entities/appointment.entity';
import { CLOCK_PORT, ClockPort } from '@domain/common/ports/clock.port';
import { LOGGER_PORT, LoggerPort } from '@domain/common/ports/logger.port';
import { DomainException, ErrorCode } from '@domain/common/exceptions';
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
  RECEIPT_IMAGE_CLASSIFIER_PORT,
  ReceiptImageClassification,
  ReceiptImageClassifierPort,
} from '@domain/deposits/ports/receipt-image-classifier.port';
import {
  DepositReceipt,
  DepositReceiptClassification,
  DepositReceiptSource,
  DepositReceiptStatus,
} from '@domain/deposits/entities/deposit-receipt.entity';
import {
  DEPOSIT_RECEIPT_REPOSITORY,
  DepositReceiptRepository,
} from '@domain/deposits/repositories/deposit-receipt.repository';
import { isValidDepositImage } from '@domain/deposits/services/deposit-qr-image-validator';
import {
  MESSAGING_PORT,
  InboundMedia,
  MessagingPort,
  OutboundClass,
} from '@domain/messaging/ports/messaging.port';
import { humanTypingDelayMs } from '@domain/messaging/services/human-pacing';
import {
  TENANT_REPOSITORY,
  TenantRepository,
} from '@domain/tenants/repositories/tenant.repository';
import { DepositOutboundCopy } from '../messages/deposit-outbound.copy';
import { ReceiveDepositReceiptUseCase } from './receive-deposit-receipt.use-case';
import { AssignDepositReceiptUseCase } from './assign-deposit-receipt.use-case';

export type CaptureInboundDepositReceiptOutcome =
  | 'not_expected'
  | 'rejected'
  | 'pending_assignment'
  | 'attached';

const RECEIPT_APPOINTMENT_LOOKBACK_MS = 24 * 60 * 60 * 1000;

interface CaptureInboundDepositReceiptInput {
  tenantId: string;
  clientId: string;
  conversationId: string;
  clientPhoneE164: string;
  providerMessageId: string;
  inReplyToProviderMessageId?: string | null;
  deferAmbiguousReply?: boolean;
  occurredAt: Date;
}

@Injectable()
export class CaptureInboundDepositReceiptUseCase {
  constructor(
    @Inject(APPOINTMENT_VIEW_REPOSITORY)
    private readonly appointmentViews: AppointmentViewRepository,
    @Inject(DEPOSIT_RECEIPT_REPOSITORY)
    private readonly receipts: DepositReceiptRepository,
    @Inject(RECEIPT_IMAGE_CLASSIFIER_PORT)
    private readonly classifier: ReceiptImageClassifierPort,
    @Inject(MESSAGING_PORT)
    private readonly messaging: MessagingPort,
    @Inject(MESSAGE_REPOSITORY)
    private readonly messages: MessageRepository,
    @Inject(TENANT_REPOSITORY)
    private readonly tenants: TenantRepository,
    @Inject(CLOCK_PORT)
    private readonly clock: ClockPort,
    @Inject(CONVERSATION_REPOSITORY)
    private readonly conversations: ConversationRepository,
    @Inject(LOGGER_PORT)
    private readonly logger: LoggerPort,
    private readonly receiveReceipt: ReceiveDepositReceiptUseCase,
    private readonly assignReceipt: AssignDepositReceiptUseCase,
  ) {}

  async execute(
    input: CaptureInboundDepositReceiptInput,
  ): Promise<CaptureInboundDepositReceiptOutcome> {
    const duplicate = await this.receipts.findByProviderMessageId(
      input.providerMessageId,
    );
    if (duplicate) {
      if (
        duplicate.status === DepositReceiptStatus.ASSIGNED &&
        duplicate.appointmentId &&
        !input.deferAmbiguousReply &&
        !(await this.messages.hasReplyTo(input.providerMessageId))
      ) {
        const [view, tenant] = await Promise.all([
          this.appointmentViews.findById(duplicate.appointmentId),
          this.tenants.findById(input.tenantId),
        ]);
        if (view) {
          await this.reply(
            input,
            DepositOutboundCopy.receiptReceived({
              serviceName: view.service.name,
              startsAtLabel: this.startsAtLabel(
                view,
                tenant?.timezone ?? 'America/La_Paz',
              ),
            }),
          );
        }
      }
      if (
        duplicate.status === DepositReceiptStatus.PENDING_ASSIGNMENT &&
        duplicate.appointmentId === null
      ) {
        return this.resumePendingReceipt(input, duplicate);
      }
      const outcome =
        duplicate.status === DepositReceiptStatus.PENDING_ASSIGNMENT
          ? 'pending_assignment'
          : 'attached';
      this.logOutcome(
        outcome,
        input.providerMessageId,
        duplicate.appointmentId ?? undefined,
      );
      return outcome;
    }

    const pending = await this.pendingAppointments(input.clientId);
    if (pending.length === 0) {
      this.logOutcome('not_expected', input.providerMessageId);
      return 'not_expected';
    }

    await this.messaging.markAsRead({
      tenantId: input.tenantId,
      toE164: input.clientPhoneE164,
      providerMessageId: input.providerMessageId,
    });
    let image: InboundMedia;
    try {
      image = await this.messaging.downloadInboundMedia({
        tenantId: input.tenantId,
        providerMessageId: input.providerMessageId,
      });
    } catch (error) {
      if (
        error instanceof DomainException &&
        error.code === ErrorCode.INVALID_DEPOSIT_RECEIPT_FILE
      ) {
        if (!input.deferAmbiguousReply) {
          await this.reply(input, DepositOutboundCopy.imageIsNotReceipt);
        }
        this.logOutcome('rejected', input.providerMessageId);
        return 'rejected';
      }
      throw error;
    }
    const validImage = isValidDepositImage({
      mimeType: image.mimeType,
      body: image.bytes,
    });
    const classification = validImage
      ? await this.classifier.classify(image)
      : ReceiptImageClassification.NOT_RECEIPT;

    if (classification === ReceiptImageClassification.NOT_RECEIPT) {
      if (!input.deferAmbiguousReply) {
        await this.reply(input, DepositOutboundCopy.imageIsNotReceipt);
      }
      this.logOutcome(
        'rejected',
        input.providerMessageId,
        undefined,
        classification,
      );
      return 'rejected';
    }

    const destination = await this.resolveDestination(input, pending);

    const receipt = await this.receiveReceipt.execute({
      conversationId: input.conversationId,
      clientId: input.clientId,
      image: { body: image.bytes, mimeType: image.mimeType },
      providerMessageId: input.providerMessageId,
      receivedAt: input.occurredAt,
      source: DepositReceiptSource.WHATSAPP,
      classification:
        classification === ReceiptImageClassification.RECEIPT
          ? DepositReceiptClassification.RECEIPT
          : DepositReceiptClassification.UNKNOWN,
    });
    if (
      receipt.status === DepositReceiptStatus.ASSIGNED &&
      receipt.appointmentId
    ) {
      const existingView = await this.appointmentViews.findById(
        receipt.appointmentId,
      );
      if (
        existingView &&
        !input.deferAmbiguousReply &&
        !(await this.messages.hasReplyTo(input.providerMessageId))
      ) {
        const tenant = await this.tenants.findById(input.tenantId);
        await this.reply(
          input,
          DepositOutboundCopy.receiptReceived({
            serviceName: existingView.service.name,
            startsAtLabel: this.startsAtLabel(
              existingView,
              tenant?.timezone ?? 'America/La_Paz',
            ),
          }),
        );
      }
      return 'attached';
    }
    const tenant = await this.tenants.findById(input.tenantId);
    const timezone = tenant?.timezone ?? 'America/La_Paz';
    if (!destination) {
      if (!input.deferAmbiguousReply) {
        await this.reply(
          input,
          DepositOutboundCopy.receiptNeedsAssignment(
            pending.map(
              (view) =>
                `${view.service.name} — ${this.startsAtLabel(view, timezone)}`,
            ),
          ),
        );
      }
      this.logOutcome(
        'pending_assignment',
        input.providerMessageId,
        undefined,
        classification,
      );
      return 'pending_assignment';
    }

    await this.assignReceipt.execute({
      receiptId: receipt.id,
      appointmentId: destination.appointment.id,
      source: 'automatic',
      consumeExpectationForConversationId: input.conversationId,
    });
    if (!input.deferAmbiguousReply) {
      await this.reply(
        input,
        DepositOutboundCopy.receiptReceived({
          serviceName: destination.service.name,
          startsAtLabel: this.startsAtLabel(destination, timezone),
          anotherPendingLabel: pending
            .filter(
              (view) => view.appointment.id !== destination.appointment.id,
            )
            .map((view) => this.startsAtLabel(view, timezone))[0],
        }),
      );
    }
    this.logOutcome(
      'attached',
      input.providerMessageId,
      destination.appointment.id,
      classification,
    );
    return 'attached';
  }

  private async resumePendingReceipt(
    input: CaptureInboundDepositReceiptInput,
    receipt: DepositReceipt,
  ): Promise<CaptureInboundDepositReceiptOutcome> {
    const pending = await this.pendingAppointments(input.clientId);
    const destination = await this.resolveDestination(input, pending);
    const tenant = await this.tenants.findById(input.tenantId);
    const timezone = tenant?.timezone ?? 'America/La_Paz';
    if (!destination) {
      if (
        !input.deferAmbiguousReply &&
        !(await this.messages.hasReplyTo(input.providerMessageId))
      ) {
        await this.reply(
          input,
          DepositOutboundCopy.receiptNeedsAssignment(
            pending.map(
              (view) =>
                `${view.service.name} — ${this.startsAtLabel(view, timezone)}`,
            ),
          ),
        );
      }
      return 'pending_assignment';
    }

    await this.assignReceipt.execute({
      receiptId: receipt.id,
      appointmentId: destination.appointment.id,
      source: 'automatic',
      consumeExpectationForConversationId: input.conversationId,
    });
    if (
      !input.deferAmbiguousReply &&
      !(await this.messages.hasReplyTo(input.providerMessageId))
    ) {
      await this.reply(
        input,
        DepositOutboundCopy.receiptReceived({
          serviceName: destination.service.name,
          startsAtLabel: this.startsAtLabel(destination, timezone),
          anotherPendingLabel: pending
            .filter(
              (view) => view.appointment.id !== destination.appointment.id,
            )
            .map((view) => this.startsAtLabel(view, timezone))[0],
        }),
      );
    }
    return 'attached';
  }

  private async resolveDestination(
    input: CaptureInboundDepositReceiptInput,
    pending: AppointmentView[],
  ): Promise<AppointmentView | null> {
    const quoted = input.inReplyToProviderMessageId
      ? await this.messages.findByProviderMessageId(
          input.inReplyToProviderMessageId,
        )
      : null;
    const quotedDestination = pending.find(
      (view) => view.appointment.id === quoted?.relatedAppointmentId,
    );
    if (quoted?.relatedAppointmentId) {
      return quotedDestination ?? null;
    }
    const expectedAppointmentId = quotedDestination
      ? null
      : await this.receipts.findExpectedAppointment({
          conversationId: input.conversationId,
          now: this.clock.now(),
        });
    return (
      quotedDestination ??
      pending.find((view) => view.appointment.id === expectedAppointmentId) ??
      (pending.length === 1 ? pending[0] : null)
    );
  }

  private startsAtLabel(view: AppointmentView, timezone: string): string {
    return DateTime.fromJSDate(view.appointment.startsAt, { zone: timezone })
      .setLocale('es-BO')
      .toFormat("cccc d 'de' LLLL, HH:mm");
  }

  private async pendingAppointments(
    clientId: string,
  ): Promise<AppointmentView[]> {
    return (
      await this.appointmentViews.findByClient({
        clientId,
        scope: 'managed',
        statuses: [AppointmentStatus.PENDING_DEPOSIT],
        from: new Date(
          this.clock.now().getTime() - RECEIPT_APPOINTMENT_LOOKBACK_MS,
        ),
      })
    ).sort(
      (left, right) =>
        left.appointment.startsAt.getTime() -
        right.appointment.startsAt.getTime(),
    );
  }

  private async reply(
    input: {
      tenantId: string;
      conversationId: string;
      clientPhoneE164: string;
      providerMessageId: string;
      occurredAt: Date;
    },
    text: string,
  ): Promise<void> {
    const conversation = await this.conversations.findById(
      input.conversationId,
    );
    if (conversation?.botPaused) return;

    const sent = await this.messaging.sendText({
      tenantId: input.tenantId,
      toE164: input.clientPhoneE164,
      text,
      typingDelayMs: humanTypingDelayMs({
        text,
        elapsedMs: this.clock.now().getTime() - input.occurredAt.getTime(),
      }),
      outboundClass: OutboundClass.AGENT_REPLY,
    });
    await this.messages.recordIfNew({
      conversationId: input.conversationId,
      providerMessageId: sent.providerMessageId,
      inReplyToProviderMessageId: input.providerMessageId,
      direction: MessageDirection.OUTBOUND,
      kind: MessageKind.TEXT,
      content: text,
      occurredAt: this.clock.now(),
    });
  }

  private logOutcome(
    outcome: CaptureInboundDepositReceiptOutcome,
    providerMessageId: string,
    appointmentId?: string,
    classification?: ReceiptImageClassification,
  ): void {
    this.logger.log?.(
      `Deposit receipt capture outcome=${outcome} providerMessageId=${providerMessageId}${appointmentId ? ` appointmentId=${appointmentId}` : ''}${classification ? ` classification=${classification}` : ''}`,
      CaptureInboundDepositReceiptUseCase.name,
    );
  }
}
