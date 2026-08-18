import { greetingReply, isPureGreeting } from './pure-greeting';

describe('isPureGreeting', () => {
  it.each(['hola', 'Hola!', 'buenas tardes', 'Buenos días.', 'hi', 'hola 🙂'])(
    'accepts %s',
    (text) => {
      expect(isPureGreeting(text)).toBe(true);
    },
  );

  it.each([
    'hola, quiero manicure',
    'buenas, ¿tienen horario?',
    'quiero una cita',
    '',
    null,
  ])('rejects %s', (text) => {
    expect(isPureGreeting(text)).toBe(false);
  });

  it('builds a short WhatsApp greeting', () => {
    expect(greetingReply('Vale')).toContain('Vale');
  });
});
