import { InjectQueue, Processor, WorkerHost } from '@nestjs/bullmq';
import { Inject, Logger, OnModuleInit } from '@nestjs/common';
import { Job, Queue } from 'bullmq';

import { DispatchAppointmentRemindersUseCase } from '@application/reminders/use-cases/dispatch-appointment-reminders.use-case';
import { SendAppointmentReminderUseCase } from '@application/reminders/use-cases/send-appointment-reminder.use-case';
import {
  TENANT_CONTEXT_PORT,
  TenantContextPort,
} from '@domain/tenants/ports/tenant-context.port';
import {
  APPOINTMENT_REMINDERS_QUEUE,
  REMINDER_DISPATCH_JOB,
  REMINDER_SEND_JOB,
} from '../queue.constants';

export interface ReminderSendJob {
  tenantId: string;
  reminderId: string;
}

interface DueReminder {
  tenantId: string;
  reminderId: string;
}

type ReminderQueueJob = ReminderSendJob | Record<string, never>;

@Processor(APPOINTMENT_REMINDERS_QUEUE, { concurrency: 4 })
export class AppointmentRemindersProcessor
  extends WorkerHost
  implements OnModuleInit
{
  private readonly logger = new Logger(AppointmentRemindersProcessor.name);

  constructor(
    private readonly dispatch: DispatchAppointmentRemindersUseCase,
    private readonly sendReminder: SendAppointmentReminderUseCase,
    @Inject(TENANT_CONTEXT_PORT)
    private readonly tenantContext: TenantContextPort,
    @InjectQueue(APPOINTMENT_REMINDERS_QUEUE)
    private readonly queue: Queue<ReminderQueueJob>,
  ) {
    super();
  }

  async onModuleInit(): Promise<void> {
    await this.queue.add(
      REMINDER_DISPATCH_JOB,
      {},
      {
        repeat: { every: 10_000 },
        removeOnComplete: 100,
        removeOnFail: 500,
      },
    );
  }

  async process(job: Job<ReminderQueueJob>): Promise<void> {
    switch (job.name) {
      case REMINDER_DISPATCH_JOB:
        return this.dispatchDue();
      case REMINDER_SEND_JOB:
        return this.send(job as Job<ReminderSendJob>);
      default:
        this.logger.warn(`Ignored unknown job ${job.name}`);
    }
  }

  private async dispatchDue(): Promise<void> {
    const batch = await this.dispatch.execute();
    await Promise.all(batch.reminderIds.map((item) => this.enqueueSend(item)));
  }

  private async enqueueSend(reminder: DueReminder): Promise<void> {
    const jobId = `reminder-send-${reminder.reminderId}`;
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
      REMINDER_SEND_JOB,
      {
        tenantId: reminder.tenantId,
        reminderId: reminder.reminderId,
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

  private async send(job: Job<ReminderSendJob>): Promise<void> {
    await this.tenantContext.runWithTenant(job.data.tenantId, () =>
      this.sendReminder.execute(job.data.reminderId),
    );
  }
}

function isReplaceableJobState(state: string): boolean {
  return state === 'completed' || state === 'unknown' || state === 'failed';
}
