import { Job, Queue } from 'bullmq';

import { DispatchAppointmentNotificationsUseCase } from '@application/appointment-notifications/use-cases/dispatch-appointment-notifications.use-case';
import { ProcessNotificationDeliveryStatusUseCase } from '@application/appointment-notifications/use-cases/process-notification-delivery-status.use-case';
import { SendAppointmentNotificationDeliveryUseCase } from '@application/appointment-notifications/use-cases/send-appointment-notification-delivery.use-case';
import { TenantContextPort } from '@domain/tenants/ports/tenant-context.port';
import {
  NOTIFICATION_DISPATCH_JOB,
  NOTIFICATION_SEND_JOB,
} from '../queue.constants';
import {
  AppointmentNotificationsProcessor,
  NotificationSendJob,
} from './appointment-notifications.processor';

describe('AppointmentNotificationsProcessor', () => {
  const buildProcessor = (queue: unknown) => {
    const dispatch = {
      execute: jest.fn().mockResolvedValue({
        deliveryIds: [{ tenantId: 'tenant-a', deliveryId: 'delivery-1' }],
      }),
    };
    const sendDelivery = { execute: jest.fn().mockResolvedValue(undefined) };
    const processStatus = { execute: jest.fn().mockResolvedValue(undefined) };
    const tenantContext = {
      tenantId: null,
      userId: null,
      runWithTenant: jest.fn((_tenantId, operation) => operation()),
    };

    return {
      processor: new AppointmentNotificationsProcessor(
        dispatch as unknown as DispatchAppointmentNotificationsUseCase,
        sendDelivery as unknown as SendAppointmentNotificationDeliveryUseCase,
        processStatus as unknown as ProcessNotificationDeliveryStatusUseCase,
        tenantContext as TenantContextPort,
        queue as Queue,
      ),
      dispatch,
      sendDelivery,
      tenantContext,
    };
  };

  const dispatchJob = {
    name: NOTIFICATION_DISPATCH_JOB,
    data: {},
  } as Job<Record<string, never>>;

  it('queues a delivery under a deterministic id that is released on completion', async () => {
    const queue = {
      getJob: jest.fn().mockResolvedValue(undefined),
      add: jest.fn().mockResolvedValue(undefined),
    };

    await buildProcessor(queue).processor.process(dispatchJob);

    expect(queue.add).toHaveBeenCalledWith(
      NOTIFICATION_SEND_JOB,
      { tenantId: 'tenant-a', deliveryId: 'delivery-1' },
      {
        jobId: 'notify-delivery-delivery-1',
        attempts: 3,
        backoff: { type: 'exponential', delay: 5_000 },
        removeOnComplete: true,
        removeOnFail: 5_000,
      },
    );
  });

  it('removes a retained completed job before requeueing a deferred delivery', async () => {
    const completed = {
      getState: jest.fn().mockResolvedValue('completed'),
      remove: jest.fn().mockResolvedValue(undefined),
    };
    const queue = {
      getJob: jest.fn().mockResolvedValue(completed),
      add: jest.fn().mockResolvedValue(undefined),
    };

    await buildProcessor(queue).processor.process(dispatchJob);

    expect(completed.remove).toHaveBeenCalledTimes(1);
    expect(queue.add).toHaveBeenCalledWith(
      NOTIFICATION_SEND_JOB,
      expect.objectContaining({ deliveryId: 'delivery-1' }),
      expect.objectContaining({
        jobId: 'notify-delivery-delivery-1',
        removeOnComplete: true,
      }),
    );
  });

  it.each(['waiting', 'delayed', 'active'])(
    'does not replace an existing %s delivery job',
    async (state) => {
      const existing = {
        getState: jest.fn().mockResolvedValue(state),
        remove: jest.fn(),
      };
      const queue = {
        getJob: jest.fn().mockResolvedValue(existing),
        add: jest.fn(),
      };

      await buildProcessor(queue).processor.process(dispatchJob);

      expect(existing.remove).not.toHaveBeenCalled();
      expect(queue.add).not.toHaveBeenCalled();
    },
  );

  it('accepts another replica replacing the completed job during cleanup', async () => {
    const completed = {
      getState: jest.fn().mockResolvedValue('completed'),
      remove: jest.fn().mockRejectedValue(new Error('job no longer exists')),
    };
    const replacement = {
      getState: jest.fn().mockResolvedValue('waiting'),
    };
    const queue = {
      getJob: jest
        .fn()
        .mockResolvedValueOnce(completed)
        .mockResolvedValueOnce(replacement),
      add: jest.fn(),
    };

    await expect(
      buildProcessor(queue).processor.process(dispatchJob),
    ).resolves.toBeUndefined();
    expect(queue.add).not.toHaveBeenCalled();
  });

  it('removes a failed job before requeueing a delivery', async () => {
    const failed = {
      getState: jest.fn().mockResolvedValue('failed'),
      remove: jest.fn().mockResolvedValue(undefined),
    };
    const queue = {
      getJob: jest.fn().mockResolvedValue(failed),
      add: jest.fn().mockResolvedValue(undefined),
    };

    await buildProcessor(queue).processor.process(dispatchJob);

    expect(failed.remove).toHaveBeenCalledTimes(1);
    expect(queue.add).toHaveBeenCalledWith(
      NOTIFICATION_SEND_JOB,
      expect.objectContaining({ deliveryId: 'delivery-1' }),
      expect.objectContaining({
        jobId: 'notify-delivery-delivery-1',
        removeOnComplete: true,
      }),
    );
  });

  it('does not hide a cleanup failure while the completed job still exists', async () => {
    const cleanupError = new Error('redis write failed');
    const completed = {
      getState: jest.fn().mockResolvedValue('completed'),
      remove: jest.fn().mockRejectedValue(cleanupError),
    };
    const queue = {
      getJob: jest.fn().mockResolvedValue(completed),
      add: jest.fn(),
    };

    await expect(
      buildProcessor(queue).processor.process(dispatchJob),
    ).rejects.toBe(cleanupError);
    expect(queue.add).not.toHaveBeenCalled();
  });

  it('runs a delivery inside its tenant context', async () => {
    const queue = {
      getJob: jest.fn(),
      add: jest.fn(),
    };
    const built = buildProcessor(queue);
    const job = {
      name: NOTIFICATION_SEND_JOB,
      data: { tenantId: 'tenant-a', deliveryId: 'delivery-1' },
    } as Job<NotificationSendJob>;

    await built.processor.process(job);

    expect(built.tenantContext.runWithTenant).toHaveBeenCalledWith(
      'tenant-a',
      expect.any(Function),
    );
    expect(built.sendDelivery.execute).toHaveBeenCalledWith('delivery-1');
  });
});
