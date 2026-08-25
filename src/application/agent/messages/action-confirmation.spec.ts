import {
  fallbackCopyForClaims,
  renderActionConfirmation,
} from './action-confirmation';
import { AgentOutboundCopy } from './agent-outbound.copy';
import { OutboundClaim } from '@domain/agent/services/outbound-claim';
import {
  bookedAction,
  cancelledAction,
} from '../services/agent-action.fixtures';

describe('action confirmation', () => {
  it('renders a booking confirmation from the receipt', () => {
    const text = renderActionConfirmation(
      bookedAction({
        facts: {
          ...bookedAction().facts,
          awaitsDeposit: true,
        },
      }),
      { depositQrQueued: true },
    );

    expect(text).toContain('queda pendiente la seña');
    expect(text).toContain('Tu reserva quedó hecha');
    expect(text).toContain('Masaje relajante 60 min');
    expect(text).toContain('17:00');
    expect(text).toContain('En el siguiente mensaje te llega el QR');
  });

  it('renders a cancellation confirmation from the receipt', () => {
    const text = renderActionConfirmation(cancelledAction());

    expect(text).toContain('quedó cancelada');
    expect(text).toContain('Masaje relajante 60 min');
    expect(text).not.toContain('Inventé');
  });

  it('picks claim-specific fallback copy', () => {
    expect(fallbackCopyForClaims([OutboundClaim.CANCELLATION])).toBe(
      AgentOutboundCopy.unverifiedCancellation,
    );
    expect(
      fallbackCopyForClaims([OutboundClaim.DEPOSIT_RECEIPT_ASSIGNMENT]),
    ).toBe(AgentOutboundCopy.unverifiedDepositReceipt);
    expect(fallbackCopyForClaims([OutboundClaim.PAYMENT_VERIFIED])).toBe(
      AgentOutboundCopy.unverifiedPayment,
    );
  });
});
