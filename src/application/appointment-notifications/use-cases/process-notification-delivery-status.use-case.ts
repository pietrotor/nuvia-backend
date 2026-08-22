import { Inject, Injectable } from '@nestjs/common';

import {
  APPOINTMENT_NOTIFICATION_DELIVERY_REPOSITORY,
  AppointmentNotificationDeliveryRepository,
} from '@domain/appointment-notifications/repositories/appointment-notification-delivery.repository';
import { AppointmentNotificationDeliveryStatus } from '@domain/appointment-notifications/value-objects/appointment-notification-delivery-status.vo';
import { CLOCK_PORT, ClockPort } from '@domain/common/ports/clock.port';
import {
  OUTBOUND_SAFETY_PORT,
  OutboundSafetyPort,
} from '@domain/messaging/ports/outbound-safety.port';

export interface ProcessNotificationDeliveryStatusInput {
  providerMessageId: string;
  status: string;
  statusCode?: number | null;
}

@Injectable()
export class ProcessNotificationDeliveryStatusUseCase {
  constructor(
    @Inject(APPOINTMENT_NOTIFICATION_DELIVERY_REPOSITORY)
    private readonly deliveries: AppointmentNotificationDeliveryRepository,
    @Inject(OUTBOUND_SAFETY_PORT)
    private readonly outboundSafety: OutboundSafetyPort,
    @Inject(CLOCK_PORT)
    private readonly clock: ClockPort,
  ) {}

  async execute(input: ProcessNotificationDeliveryStatusInput): Promise<void> {
    const delivery = await this.deliveries.findByProviderMessageId(
      input.providerMessageId,
    );
    if (!delivery) return;

    const now = this.clock.now();
    if (is463(input)) {
      await this.outboundSafety.openBreaker(delivery.tenantId);
      if (delivery.status !== AppointmentNotificationDeliveryStatus.FAILED) {
        await this.deliveries.save(
          delivery.markFailed({
            now,
            lastErrorCode: 'whatsapp_463',
            lastError: 'provider_463',
          }),
        );
      }
      return;
    }

    if (isDelivered(input.status)) {
      if (delivery.status === AppointmentNotificationDeliveryStatus.DELIVERED) {
        return;
      }
      await this.deliveries.save(delivery.markDelivered(now));
      return;
    }

    if (isFailed(input.status)) {
      await this.deliveries.save(
        delivery.markFailed({
          now,
          lastErrorCode: 'provider_error',
          lastError: input.status,
        }),
      );
    }
  }
}

function is463(input: ProcessNotificationDeliveryStatusInput): boolean {
  return (
    input.statusCode === 463 ||
    /\b463\b/.test(input.status) ||
    input.status.toUpperCase().includes('DEVICE_REMOVED')
  );
}

function isDelivered(status: string): boolean {
  const normalized = status.toUpperCase();
  return (
    normalized.includes('DELIVER') ||
    normalized.includes('READ') ||
    normalized.includes('PLAYED') ||
    normalized === 'DELIVERY_ACK'
  );
}

function isFailed(status: string): boolean {
  const normalized = status.toUpperCase();
  return (
    normalized.includes('ERROR') ||
    normalized.includes('FAILED') ||
    normalized.includes('DELETED')
  );
}
