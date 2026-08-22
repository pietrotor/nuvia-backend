import { Inject, Injectable } from '@nestjs/common';
import { DateTime } from 'luxon';

import {
  APPOINTMENT_REPOSITORY,
  AppointmentRepository,
} from '@domain/appointments/repositories/appointment.repository';
import { AppointmentStatus } from '@domain/appointments/entities/appointment.entity';
import { AppointmentNotFoundError } from '@domain/appointments/exceptions/appointment.exceptions';
import {
  BRANCH_SERVICE_REPOSITORY,
  BranchServiceRepository,
} from '@domain/branches/repositories/branch-service.repository';
import { resolveEffectiveBranchService } from '@domain/branches/services/effective-branch-service';
import { CLOCK_PORT, ClockPort } from '@domain/common/ports/clock.port';
import { LOGGER_PORT, LoggerPort } from '@domain/common/ports/logger.port';
import {
  MessageDirection,
  MessageKind,
} from '@domain/conversations/entities/message.entity';
import {
  MESSAGE_REPOSITORY,
  MessageRepository,
} from '@domain/conversations/repositories/message.repository';
import {
  DEPOSIT_QR_REPOSITORY,
  DepositQrRepository,
} from '@domain/deposits/repositories/deposit-qr.repository';
import { calculateDepositAmount } from '@domain/deposits/services/deposit-amount';
import { resolveDepositQr } from '@domain/deposits/services/deposit-qr-resolver';
import {
  MESSAGING_PORT,
  MessagingPort,
  OutboundClass,
} from '@domain/messaging/ports/messaging.port';
import {
  SERVICE_REPOSITORY,
  ServiceRepository,
} from '@domain/services/repositories/service.repository';
import { ServiceNotFoundError } from '@domain/services/exceptions/service.exceptions';
import {
  OBJECT_STORAGE_PORT,
  ObjectStoragePort,
} from '@domain/storage/ports/object-storage.port';
import {
  TENANT_REPOSITORY,
  TenantRepository,
} from '@domain/tenants/repositories/tenant.repository';
import { DepositOutboundCopy } from '../messages/deposit-outbound.copy';

// Invoked from the agent flow rather than from HTTP, so the caller already knows the
// conversation the QR belongs to.
export interface SendDepositQrInput {
  appointmentId: string;
  conversationId: string;
  clientPhoneE164: string;
}

export type SendDepositQrOutcome =
  | 'sent'
  | 'no_deposit_required'
  | 'not_pending_deposit'
  | 'no_qr_configured';

export interface SendDepositQrResult {
  outcome: SendDepositQrOutcome;
  // What the client was told to transfer, so the caller can repeat it in text.
  amount: string | null;
}

@Injectable()
export class SendDepositQrUseCase {
  constructor(
    @Inject(APPOINTMENT_REPOSITORY)
    private readonly appointmentRepository: AppointmentRepository,
    @Inject(SERVICE_REPOSITORY)
    private readonly serviceRepository: ServiceRepository,
    @Inject(BRANCH_SERVICE_REPOSITORY)
    private readonly branchServiceRepository: BranchServiceRepository,
    @Inject(DEPOSIT_QR_REPOSITORY)
    private readonly depositQrRepository: DepositQrRepository,
    @Inject(MESSAGE_REPOSITORY)
    private readonly messageRepository: MessageRepository,
    @Inject(OBJECT_STORAGE_PORT)
    private readonly storage: ObjectStoragePort,
    @Inject(MESSAGING_PORT)
    private readonly messaging: MessagingPort,
    @Inject(CLOCK_PORT)
    private readonly clock: ClockPort,
    @Inject(LOGGER_PORT)
    private readonly logger: LoggerPort,
    @Inject(TENANT_REPOSITORY)
    private readonly tenantRepository: TenantRepository,
  ) {}

  async execute(input: SendDepositQrInput): Promise<SendDepositQrResult> {
    const appointment = await this.appointmentRepository.findById(
      input.appointmentId,
    );
    if (!appointment) throw new AppointmentNotFoundError(input.appointmentId);

    // A deposit already verified, or an appointment cancelled between the booking and
    // this send, must not receive a QR asking for money.
    if (appointment.status !== AppointmentStatus.PENDING_DEPOSIT) {
      return { outcome: 'not_pending_deposit', amount: null };
    }

    const service = await this.serviceRepository.findById(
      appointment.serviceId,
    );
    if (!service) throw new ServiceNotFoundError(appointment.serviceId);

    const branchService = appointment.branchId
      ? await this.branchServiceRepository.findByBranchAndService(
          appointment.branchId,
          service.id,
        )
      : null;
    const effective =
      branchService && branchService.isActive
        ? resolveEffectiveBranchService(service, branchService)
        : null;

    const amount =
      appointment.depositAmount ??
      effective?.depositAmount ??
      calculateDepositAmount(service);
    if (!amount) return { outcome: 'no_deposit_required', amount: null };

    const depositQr = resolveDepositQr({
      serviceDepositQrId: effective?.depositQrId ?? service.depositQrId,
      branchId: appointment.branchId,
      activeDepositQrs: await this.depositQrRepository.findAll(),
    });
    if (!depositQr) {
      // Nothing to charge with: the business either uploaded no QR or has several
      // without a default. Saying so is the owner's problem to fix, not the client's.
      this.logger.warn(
        `No deposit QR to charge appointment ${appointment.id}`,
        SendDepositQrUseCase.name,
      );
      return { outcome: 'no_qr_configured', amount: amount.display() };
    }

    const [image, tenant] = await Promise.all([
      this.storage.get(depositQr.storageKey),
      this.tenantRepository.findById(appointment.tenantId),
    ]);
    const startsAtLabel = DateTime.fromJSDate(appointment.startsAt)
      .setZone(tenant?.timezone ?? 'America/La_Paz')
      .setLocale('es')
      .toFormat("cccc d 'de' LLLL, HH:mm");
    const caption = DepositOutboundCopy.qrCaption({
      serviceName: service.name,
      amount: amount.display(),
      startsAtLabel,
    });
    const sent = await this.messaging.sendMedia({
      tenantId: appointment.tenantId,
      toE164: input.clientPhoneE164,
      media: { source: 'bytes', bytes: image.body },
      mimeType: image.contentType ?? depositQr.mimeType,
      caption,
      outboundClass: OutboundClass.TRANSACTIONAL,
    });
    await this.messageRepository.recordIfNew({
      conversationId: input.conversationId,
      providerMessageId: sent.providerMessageId,
      direction: MessageDirection.OUTBOUND,
      kind: MessageKind.IMAGE,
      content: caption,
      relatedAppointmentId: appointment.id,
      occurredAt: this.clock.now(),
    });

    return { outcome: 'sent', amount: amount.display() };
  }
}
