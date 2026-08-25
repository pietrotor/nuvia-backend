import { CancelAppointmentUseCase } from '@application/appointments/use-cases/cancel-appointment.use-case';
import { GetAppointmentUseCase } from '@application/appointments/use-cases/get-appointment.use-case';
import { GetBranchUseCase } from '@application/branches/use-cases/get-branch.use-case';
import { AppointmentStatus } from '@domain/appointments/entities/appointment.entity';
import { CancelAppointmentAgentTool } from './cancel-appointment.agent-tool';

const context = {
  tenantId: 'tenant-id',
  conversationId: 'conversation-id',
  clientId: 'client-id',
  clientPhoneE164: '+59170000000',
  timezone: 'America/La_Paz',
  branchId: 'branch-1',
};

describe('CancelAppointmentAgentTool', () => {
  const cancelAppointment = {
    execute: jest.fn(),
  } as unknown as CancelAppointmentUseCase;
  const getAppointment = {
    execute: jest.fn(),
  } as unknown as GetAppointmentUseCase;
  const getBranch = {
    execute: jest.fn(),
  } as unknown as GetBranchUseCase;
  const tool = new CancelAppointmentAgentTool(
    cancelAppointment,
    getAppointment,
    getBranch,
  );

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('refuses without an explicit client confirmation', async () => {
    const result = await tool.execute(
      {
        appointmentId: '11111111-1111-4111-8111-111111111111',
        confirmedByClient: false,
      },
      context,
    );

    expect(result.status).toBe('warning');
    expect(result.committedAction).toBeUndefined();
    expect(cancelAppointment.execute).not.toHaveBeenCalled();
  });

  it('emits a committed receipt only after the use case cancels', async () => {
    (cancelAppointment.execute as jest.Mock).mockResolvedValue({
      appointment: {
        id: '11111111-1111-4111-8111-111111111111',
        status: AppointmentStatus.CANCELLED,
        startsAt: new Date('2026-08-26T21:00:00.000Z'),
        branchId: 'branch-1',
      },
      depositAtRisk: false,
    });
    (getAppointment.execute as jest.Mock).mockResolvedValue({
      appointment: {
        id: '11111111-1111-4111-8111-111111111111',
        startsAt: new Date('2026-08-26T21:00:00.000Z'),
        branchId: 'branch-1',
      },
      client: { name: 'Pietro' },
      service: { name: 'Masaje relajante 60 min' },
      professional: { name: 'Valeria Mamani' },
    });
    (getBranch.execute as jest.Mock).mockResolvedValue({
      id: 'branch-1',
      name: 'Casa Matriz',
    });

    const result = await tool.execute(
      {
        appointmentId: '11111111-1111-4111-8111-111111111111',
        confirmedByClient: true,
        reason: 'No podré ir',
      },
      context,
    );

    expect(cancelAppointment.execute).toHaveBeenCalled();
    expect(result.status).toBe('success');
    expect(result.committedAction).toEqual(
      expect.objectContaining({
        operation: 'appointment.cancel',
        resourceId: '11111111-1111-4111-8111-111111111111',
        outcome: 'committed',
        facts: expect.objectContaining({
          serviceName: 'Masaje relajante 60 min',
          startsAtLabel: '17:00',
        }),
      }),
    );
  });
});
