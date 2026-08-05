import { toWhatsAppText } from './whatsapp-text';

describe('toWhatsAppText', () => {
  it('converts markdown double-asterisk bold to WhatsApp single-asterisk bold', () => {
    expect(toWhatsAppText('Mirá **MENSAJES** acá')).toBe('Mirá *MENSAJES* acá');
  });

  it('converts markdown underscores to WhatsApp bold', () => {
    expect(toWhatsAppText('Hola __cliente__')).toBe('Hola *cliente*');
  });

  it('strips markdown headings', () => {
    expect(toWhatsAppText('## Servicios\n- Facial')).toBe(
      'Servicios\n- Facial',
    );
  });

  it('tightens spaced asterisks so WhatsApp can bold them', () => {
    expect(toWhatsAppText('Hola * MENSAJES *')).toBe('Hola *MENSAJES*');
  });

  it('leaves already-correct WhatsApp bold alone', () => {
    expect(toWhatsAppText('Hola *Vale*')).toBe('Hola *Vale*');
  });
});
