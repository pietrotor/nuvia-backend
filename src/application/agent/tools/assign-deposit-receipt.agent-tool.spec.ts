import { AssignDepositReceiptAgentTool } from './assign-deposit-receipt.agent-tool';

const context = {
  tenantId: '11111111-1111-4111-8111-111111111111',
  conversationId: '22222222-2222-4222-8222-222222222222',
  clientId: '33333333-3333-4333-8333-333333333333',
  clientPhoneE164: '+59170000000',
  timezone: 'America/La_Paz',
  branchId: null,
  quotedProviderMessageId: null,
};

describe('AssignDepositReceiptAgentTool', () => {
  it('moves the latest receipt when the client corrects its appointment', async () => {
    const receipts = {
      findLatestPendingForConversation: jest.fn().mockResolvedValue({
        id: '44444444-4444-4444-8444-444444444444',
      }),
      findByProviderMessageId: jest.fn(),
    };
    const messages = { findByProviderMessageId: jest.fn() };
    const assignReceipt = { execute: jest.fn().mockResolvedValue(undefined) };
    const tool = new AssignDepositReceiptAgentTool(
      receipts as never,
      messages as never,
      assignReceipt as never,
    );

    const result = await tool.execute(
      { appointmentId: '55555555-5555-4555-8555-555555555555' },
      context,
    );

    expect(assignReceipt.execute).toHaveBeenCalledWith({
      receiptId: '44444444-4444-4444-8444-444444444444',
      appointmentId: '55555555-5555-4555-8555-555555555555',
      source: 'agent',
    });
    expect(result.status).toBe('success');
  });

  it('prefers the receipt from the quoted image', async () => {
    const receipts = {
      findByProviderMessageId: jest.fn().mockResolvedValue({
        id: '66666666-6666-4666-8666-666666666666',
      }),
      findLatestPendingForConversation: jest.fn(),
    };
    const messages = { findByProviderMessageId: jest.fn() };
    const assignReceipt = { execute: jest.fn().mockResolvedValue(undefined) };
    const tool = new AssignDepositReceiptAgentTool(
      receipts as never,
      messages as never,
      assignReceipt as never,
    );

    await tool.execute(
      { appointmentId: '55555555-5555-4555-8555-555555555555' },
      { ...context, quotedProviderMessageId: 'quoted-image' },
    );

    expect(receipts.findLatestPendingForConversation).not.toHaveBeenCalled();
    expect(assignReceipt.execute).toHaveBeenCalledWith(
      expect.objectContaining({
        receiptId: '66666666-6666-4666-8666-666666666666',
      }),
    );
  });

  it('uses the appointment linked to a quoted QR', async () => {
    const receipts = {
      findByProviderMessageId: jest.fn().mockResolvedValue(null),
      findLatestPendingForConversation: jest.fn().mockResolvedValue({
        id: '66666666-6666-4666-8666-666666666666',
      }),
    };
    const messages = {
      findByProviderMessageId: jest.fn().mockResolvedValue({
        relatedAppointmentId: '77777777-7777-4777-8777-777777777777',
      }),
    };
    const assignReceipt = { execute: jest.fn().mockResolvedValue(undefined) };
    const tool = new AssignDepositReceiptAgentTool(
      receipts as never,
      messages as never,
      assignReceipt as never,
    );

    await tool.execute(
      { appointmentId: '55555555-5555-4555-8555-555555555555' },
      { ...context, quotedProviderMessageId: 'quoted-qr' },
    );

    expect(assignReceipt.execute).toHaveBeenCalledWith(
      expect.objectContaining({
        appointmentId: '77777777-7777-4777-8777-777777777777',
      }),
    );
  });

  it('does not fall back when an explicit receipt reference is invalid', async () => {
    const receipts = {
      findByProviderMessageId: jest.fn().mockResolvedValue(null),
      findLatestPendingForConversation: jest.fn(),
    };
    const messages = { findByProviderMessageId: jest.fn() };
    const assignReceipt = { execute: jest.fn() };
    const tool = new AssignDepositReceiptAgentTool(
      receipts as never,
      messages as never,
      assignReceipt as never,
    );

    const result = await tool.execute(
      {
        appointmentId: '55555555-5555-4555-8555-555555555555',
        receiptProviderMessageId: 'missing-reference',
      },
      context,
    );

    expect(result.status).toBe('warning');
    expect(receipts.findLatestPendingForConversation).not.toHaveBeenCalled();
    expect(assignReceipt.execute).not.toHaveBeenCalled();
  });
});
