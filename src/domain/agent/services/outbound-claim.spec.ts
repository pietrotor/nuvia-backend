import { AgentActionEvidence } from './agent-action';
import {
  DEPOSIT_QR_QUEUED,
  detectOutboundClaims,
  OutboundClaim,
  unsupportedClaims,
} from './outbound-claim';

function evidence(
  ...operations: AgentActionEvidence['operation'][]
): AgentActionEvidence[] {
  return operations.map((operation) => ({ operation }));
}

describe('outbound claims', () => {
  describe('booking', () => {
    // Every one of these went out to a real client while the schedule stayed empty.
    it.each([
      'Listo, te agendo Hidrafacial con Camila Rojas mañana domingo 9 de agosto a las 19:00.',
      'Perfecto, te agendo Hidrafacial con Camila Rojas mañana.',
      'Listo, te reservo Hidrafacial con Camila Rojas mañana a las 19:00.',
      'Sí, se agendó. Deberías recibir el QR en un mensaje aparte.',
      'Ya está agendada tu cita.',
      'Tu reserva ya está confirmada.',
      'Quedó reservado el horario.',
      'Te agendé el turno.',
    ])('flags "%s"', (text) => {
      expect(detectOutboundClaims(text)).toContain(OutboundClaim.BOOKING);
    });

    it.each([
      'Perfecto, confirmo: Hidrafacial con Camila Rojas mañana a las 19:00, ¿correcto?',
      '¿Confirmás este horario para reservar?',
      '¿Querés que busque horarios para reservar mañana?',
      'Para reservar necesito que me confirmes el horario.',
      'Este tratamiento requiere seña al reservar.',
    ])('does not flag "%s"', (text) => {
      expect(detectOutboundClaims(text)).not.toContain(OutboundClaim.BOOKING);
    });
  });

  describe('cancellation', () => {
    it.each([
      'Listo, cancelamos tu reserva del masaje del miércoles 26 a las 17:00.',
      'Listo, ahora sí. Tu cita del masaje del miércoles 26 a las 17:00 quedó cancelada.',
      'Ya cancelé tu cita.',
      'Tu turno quedó cancelado.',
      'La cita ya está cancelada.',
    ])('flags "%s"', (text) => {
      expect(detectOutboundClaims(text)).toContain(OutboundClaim.CANCELLATION);
    });

    it.each([
      '¿Confirmás que querés cancelarla?',
      '¿Querés que cancele la cita?',
      'Antes de cancelar, ¿hay algún motivo?',
    ])('does not flag "%s"', (text) => {
      expect(detectOutboundClaims(text)).not.toContain(
        OutboundClaim.CANCELLATION,
      );
    });
  });

  describe('reschedule', () => {
    it.each([
      'Listo, te reagendé para el jueves a las 16:00.',
      'Ya moví tu cita al viernes.',
      'Tu turno quedó reagendado.',
      'Cambié tu horario al martes.',
    ])('flags "%s"', (text) => {
      expect(detectOutboundClaims(text)).toContain(OutboundClaim.RESCHEDULE);
    });

    it.each([
      '¿Querés que te reagende para otro día?',
      '¿Confirmás el nuevo horario para reagendar?',
    ])('does not flag "%s"', (text) => {
      expect(detectOutboundClaims(text)).not.toContain(
        OutboundClaim.RESCHEDULE,
      );
    });
  });

  describe('handoff', () => {
    it.each([
      'Ya avisé al equipo para que te continúe.',
      'Te derivé con una persona del equipo.',
      'El equipo ya fue notificado.',
    ])('flags "%s"', (text) => {
      expect(detectOutboundClaims(text)).toContain(OutboundClaim.HANDOFF);
    });

    it('does not flag an offer to hand off', () => {
      expect(
        detectOutboundClaims('¿Querés que te derive con el equipo?'),
      ).not.toContain(OutboundClaim.HANDOFF);
    });
  });

  describe('client name', () => {
    it.each([
      'Ya guardé tu nombre como Ana.',
      'Tu nombre quedó registrado.',
      'Ya te tengo registrada.',
    ])('flags "%s"', (text) => {
      expect(detectOutboundClaims(text)).toContain(OutboundClaim.CLIENT_NAME);
    });
  });

  describe('branch selection', () => {
    it.each([
      'Ya fijé la sucursal Centro.',
      'Quedamos en la sucursal Casa Matriz.',
      'La sucursal quedó elegida.',
    ])('flags "%s"', (text) => {
      expect(detectOutboundClaims(text)).toContain(
        OutboundClaim.BRANCH_SELECTION,
      );
    });
  });

  describe('payment verified', () => {
    it.each([
      'Tu pago quedó confirmado.',
      'Ya verifiqué tu seña.',
      'El equipo ya verificó el pago.',
    ])('flags "%s"', (text) => {
      expect(detectOutboundClaims(text)).toContain(
        OutboundClaim.PAYMENT_VERIFIED,
      );
    });
  });

  describe('deposit QR', () => {
    it.each([
      'En un momento te llega el QR con el monto de la seña.',
      'Ya te envié el QR con el monto.',
      'El QR ya está en el chat.',
      'Si no te llegó, te lo reenvío ahora mismo.',
      // These reached a real client while nothing had been sent.
      'Te reenví el QR. Revisá si te llegó en un mensaje aparte.',
      'Te lo reenví recién.',
      'Sí, se agendó. Deberías recibir el QR en un mensaje aparte.',
    ])('flags "%s"', (text) => {
      expect(detectOutboundClaims(text)).toContain(OutboundClaim.DEPOSIT_QR);
    });

    it.each([
      'Una vez que confirmes la reserva, te envío un QR para que hagas el pago.',
      'Sí, este tratamiento requiere seña.',
      // Offering to resend is not resending. This one handed a client off to a human for
      // asking whether she still owed a deposit.
      'Tenés una sesión pendiente de seña. ¿Querés que te reenvíe el QR para realizar el pago o preferís hacer algún cambio?',
      '¿Te reenvío el QR?',
      'Querés que te lo reenvíe?',
    ])('does not flag "%s"', (text) => {
      expect(detectOutboundClaims(text)).not.toContain(
        OutboundClaim.DEPOSIT_QR,
      );
    });

    it('still flags a claim that precedes a question', () => {
      expect(detectOutboundClaims('Ya te reenvié el QR. ¿Te llegó?')).toContain(
        OutboundClaim.DEPOSIT_QR,
      );
    });
  });

  describe('deposit receipt expectation', () => {
    it('flags a future assignment promise', () => {
      expect(
        detectOutboundClaims(
          'La próxima imagen la asignaré a tu cita del viernes.',
        ),
      ).toContain(OutboundClaim.DEPOSIT_RECEIPT_EXPECTATION);
    });
  });

  describe('evidence', () => {
    const answer = 'Listo, te agendo el turno. En un momento te llega el QR.';

    it('reports both claims when nothing ran', () => {
      expect(unsupportedClaims(answer, [])).toEqual([
        OutboundClaim.BOOKING,
        OutboundClaim.DEPOSIT_QR,
      ]);
    });

    it('accepts the booking but not the QR it never queued', () => {
      // A service that charges no deposit books fine and sends no image.
      expect(unsupportedClaims(answer, evidence('appointment.book'))).toEqual([
        OutboundClaim.DEPOSIT_QR,
      ]);
    });

    it('accepts the QR once the booking queued it', () => {
      expect(
        unsupportedClaims(
          answer,
          evidence('appointment.book', DEPOSIT_QR_QUEUED),
        ),
      ).toEqual([]);
    });

    it('does not accept an unrelated tool as proof', () => {
      expect(
        unsupportedClaims(answer, evidence('conversation.handoff')),
      ).toEqual([OutboundClaim.BOOKING, OutboundClaim.DEPOSIT_QR]);
    });

    it('accepts a resend for the QR but still asks for the booking', () => {
      expect(unsupportedClaims(answer, evidence('deposit.qr_sent'))).toEqual([
        OutboundClaim.BOOKING,
      ]);
    });

    it('stays quiet on an answer that claims nothing', () => {
      expect(
        unsupportedClaims('Tenemos limpieza facial y peeling.', []),
      ).toEqual([]);
    });

    it('requires assignment evidence before claiming a receipt correction', () => {
      const correction =
        'Listo, el comprobante quedó corregido para el viernes.';
      expect(unsupportedClaims(correction, [])).toEqual([
        OutboundClaim.DEPOSIT_RECEIPT_ASSIGNMENT,
      ]);
      expect(
        unsupportedClaims(correction, evidence('deposit.receipt_assigned')),
      ).toEqual([]);
    });

    it('never accepts payment verification from the agent', () => {
      expect(
        unsupportedClaims(
          'Tu pago quedó confirmado.',
          evidence('appointment.book'),
        ),
      ).toEqual([OutboundClaim.PAYMENT_VERIFIED]);
    });

    it('requires cancel evidence for a cancellation claim', () => {
      const cancelled =
        'Listo, cancelamos tu reserva del masaje del miércoles 26 a las 17:00.';
      expect(unsupportedClaims(cancelled, [])).toEqual([
        OutboundClaim.CANCELLATION,
      ]);
      expect(
        unsupportedClaims(cancelled, evidence('appointment.cancel')),
      ).toEqual([]);
      expect(
        unsupportedClaims(cancelled, evidence('appointment.book')),
      ).toEqual([OutboundClaim.CANCELLATION]);
    });

    it('keeps reschedule distinct from booking', () => {
      const moved = 'Listo, te reagendé para el jueves a las 16:00.';
      expect(unsupportedClaims(moved, evidence('appointment.book'))).toEqual([
        OutboundClaim.RESCHEDULE,
      ]);
      expect(
        unsupportedClaims(moved, evidence('appointment.reschedule')),
      ).toEqual([]);
    });
  });
});
