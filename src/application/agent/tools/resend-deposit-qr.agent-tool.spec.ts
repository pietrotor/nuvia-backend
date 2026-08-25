import { SendDepositQrUseCase } from '@application/deposits/use-cases/send-deposit-qr.use-case';
import { AppointmentNotFoundError } from '@domain/appointments/exceptions/appointment.exceptions';
import { AgentContext } from './agent-tool';
import { ResendDepositQrAgentTool } from './resend-deposit-qr.agent-tool';

const APPOINTMENT_ID = '5ae61296-5d4c-43ad-95f8-909963c01918';
const SERVICE_ID = '12a90cba-f448-4a7c-b60f-562bf6896ee2';

const context: AgentContext = {
  tenantId: 'tenant-1',
  conversationId: 'conversation-1',
  clientId: '9d8c7b6a-5f4e-4d3c-8b2a-1f0e9d8c7b6a',
  clientPhoneE164: '+59177410710',
  timezone: 'America/La_Paz',
  branchId: null,
};

describe('ResendDepositQrAgentTool', () => {
  let sendDepositQr: { execute: jest.Mock };
  let tool: ResendDepositQrAgentTool;

  beforeEach(() => {
    sendDepositQr = {
      execute: jest
        .fn()
        .mockResolvedValue({ outcome: 'sent', amount: 'Bs 50' }),
    };
    tool = new ResendDepositQrAgentTool(
      sendDepositQr as unknown as SendDepositQrUseCase,
    );
  });

  it('resends the QR for a real appointment', async () => {
    const result = await tool.execute(
      { appointmentId: APPOINTMENT_ID },
      context,
    );

    expect(result.status).toBe('success');
    expect(sendDepositQr.execute).toHaveBeenCalledWith({
      appointmentId: APPOINTMENT_ID,
      conversationId: 'conversation-1',
      clientPhoneE164: '+59177410710',
    });
  });

  // The service id sits in the catalog block of every prompt, so it is the uuid the model
  // reaches for when it has no appointment id at hand. A generic error taught it that
  // resending is not allowed, and it handed the conversation off instead of correcting.
  it('says the id is not an appointment instead of failing opaquely', async () => {
    sendDepositQr.execute.mockRejectedValue(
      new AppointmentNotFoundError(SERVICE_ID),
    );

    const result = await tool.execute({ appointmentId: SERVICE_ID }, context);

    expect(result.status).toBe('warning');
    expect(result.summary).toContain('no es de ninguna cita');
    expect(result.nextActions).toEqual(
      expect.arrayContaining([expect.stringContaining('list_my_appointments')]),
    );
  });

  it('treats an id that is not a uuid the same way', async () => {
    const result = await tool.execute(
      { appointmentId: 'hidrafacial' },
      context,
    );

    expect(result.status).toBe('warning');
    expect(result.summary).toContain('no es de ninguna cita');
    expect(sendDepositQr.execute).not.toHaveBeenCalled();
  });

  it('tells the agent to hand off when the business has no QR', async () => {
    sendDepositQr.execute.mockResolvedValue({
      outcome: 'no_qr_configured',
      amount: 'Bs 50',
    });

    const result = await tool.execute(
      { appointmentId: APPOINTMENT_ID },
      context,
    );

    expect(result.status).toBe('error');
    expect(result.nextActions).toEqual(
      expect.arrayContaining([expect.stringContaining('request_handoff')]),
    );
  });

  // A failure we cannot explain is a bug: swallowing it would teach the model to
  // apologise for something we never got to see.
  it('lets an unexpected failure through', async () => {
    sendDepositQr.execute.mockRejectedValue(new Error('connection lost'));

    await expect(
      tool.execute({ appointmentId: APPOINTMENT_ID }, context),
    ).rejects.toThrow('connection lost');
  });
});
