import { InjectQueue, Processor, WorkerHost } from '@nestjs/bullmq';
import { Inject, Logger, OnModuleInit } from '@nestjs/common';
import { Job, Queue } from 'bullmq';

import { DispatchAppointmentNotificationsUseCase } from '@application/appointment-notifications/use-cases/dispatch-appointment-notifications.use-case';
import { ProcessNotificationDeliveryStatusUseCase } from '@application/appointment-notifications/use-cases/process-notification-delivery-status.use-case';
import { SendAppointmentNotificationDeliveryUseCase } from '@application/appointment-notifications/use-cases/send-appointment-notification-delivery.use-case';
import {
  TENANT_CONTEXT_PORT,
  TenantContextPort,
} from '@domain/tenants/ports/tenant-context.port';
import {
  APPOINTMENT_NOTIFICATIONS_QUEUE,
  NOTIFICATION_DISPATCH_JOB,
  NOTIFICATION_SEND_JOB,
  NOTIFICATION_STATUS_JOB,
} from '../queue.constants';

export interface NotificationSendJob {
  tenantId: string;
  deliveryId: string;
}

export interface NotificationStatusJob {
  tenantId: string;
  providerMessageId: string;
  status: string;
  statusCode?: number | null;
}

interface DueNotificationDelivery {
  tenantId: string;
  deliveryId: string;
}

type NotificationQueueJob =
  | NotificationSendJob
  | NotificationStatusJob
  | Record<string, never>;

@Processor(APPOINTMENT_NOTIFICATIONS_QUEUE, { concurrency: 4 })
export class AppointmentNotificationsProcessor
  extends WorkerHost
  implements OnModuleInit
{
  private readonly logger = new Logger(AppointmentNotificationsProcessor.name);

  constructor(
    private readonly dispatch: DispatchAppointmentNotificationsUseCase,
    private readonly sendDelivery: SendAppointmentNotificationDeliveryUseCase,
    private readonly processStatus: ProcessNotificationDeliveryStatusUseCase,
    @Inject(TENANT_CONTEXT_PORT)
    private readonly tenantContext: TenantContextPort,
    @InjectQueue(APPOINTMENT_NOTIFICATIONS_QUEUE)
    private readonly queue: Queue<NotificationQueueJob>,
  ) {
    super();
  }

  async onModuleInit(): Promise<void> {
    await this.queue.add(
      NOTIFICATION_DISPATCH_JOB,
      {},
      {
        repeat: { every: 10_000 },
        removeOnComplete: 100,
        removeOnFail: 500,
      },
    );
  }

  async process(job: Job<NotificationQueueJob>): Promise<void> {
    switch (job.name) {
      case NOTIFICATION_DISPATCH_JOB:
        return this.dispatchDue();
      case NOTIFICATION_SEND_JOB:
        return this.send(job as Job<NotificationSendJob>);
      case NOTIFICATION_STATUS_JOB:
        return this.status(job as Job<NotificationStatusJob>);
      default:
        this.logger.warn(`Ignored unknown job ${job.name}`);
    }
  }

  private async dispatchDue(): Promise<void> {
    const batch = await this.dispatch.execute();
    await Promise.all(
      batch.deliveryIds.map((item) => this.enqueueSendDelivery(item)),
    );
  }

  private async enqueueSendDelivery(
    delivery: DueNotificationDelivery,
  ): Promise<void> {
    const jobId = `notify-delivery-${delivery.deliveryId}`;
    const existing = await this.queue.getJob(jobId);
    if (existing) {
      const state = await existing.getState();
      if (!isReplaceableJobState(state)) return;

      try {
        await existing.remove();
      } catch (error) {
        const replacement = await this.queue.getJob(jobId);
        if (replacement) {
          const replacementState = await replacement.getState();
          if (!isReplaceableJobState(replacementState)) return;
          throw error;
        }
      }
    }

    await this.queue.add(
      NOTIFICATION_SEND_JOB,
      {
        tenantId: delivery.tenantId,
        deliveryId: delivery.deliveryId,
      },
      {
        jobId,
        attempts: 3,
        backoff: { type: 'exponential', delay: 5_000 },
        removeOnComplete: true,
        removeOnFail: 5_000,
      },
    );
  }

  private async send(job: Job<NotificationSendJob>): Promise<void> {
    await this.tenantContext.runWithTenant(job.data.tenantId, () =>
      this.sendDelivery.execute(job.data.deliveryId),
    );
  }

  private async status(job: Job<NotificationStatusJob>): Promise<void> {
    await this.tenantContext.runWithTenant(job.data.tenantId, () =>
      this.processStatus.execute({
        providerMessageId: job.data.providerMessageId,
        status: job.data.status,
        statusCode: job.data.statusCode,
      }),
    );
  }
}

function isReplaceableJobState(state: string): boolean {
  return state === 'completed' || state === 'unknown' || state === 'failed';
}
