import {
  DEPOSIT_QR_QUEUED,
  detectOutboundClaims,
  OutboundClaim,
  unsupportedClaims,
} from './outbound-claim';

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
    ])('does not flag "%s"', (text) => {
      expect(detectOutboundClaims(text)).not.toContain(
        OutboundClaim.DEPOSIT_QR,
      );
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
      expect(unsupportedClaims(answer, ['book_appointment'])).toEqual([
        OutboundClaim.DEPOSIT_QR,
      ]);
    });

    it('accepts the QR once the booking queued it', () => {
      expect(
        unsupportedClaims(answer, ['book_appointment', DEPOSIT_QR_QUEUED]),
      ).toEqual([]);
    });

    it('does not accept an unrelated tool as proof', () => {
      expect(unsupportedClaims(answer, ['find_availability'])).toEqual([
        OutboundClaim.BOOKING,
        OutboundClaim.DEPOSIT_QR,
      ]);
    });

    it('accepts a resend for the QR but still asks for the booking', () => {
      expect(unsupportedClaims(answer, ['resend_deposit_qr'])).toEqual([
        OutboundClaim.BOOKING,
      ]);
    });

    it('stays quiet on an answer that claims nothing', () => {
      expect(
        unsupportedClaims('Tenemos limpieza facial y peeling.', []),
      ).toEqual([]);
    });
  });
});
