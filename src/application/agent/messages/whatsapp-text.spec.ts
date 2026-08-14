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

  // Reached a client as "a las *17:00*el*lunes 17 de agosto*": the closing asterisk of one
  // bold was read as the opening of the next, and the words in between lost their spaces.
  it('keeps two bolds in a row apart instead of pairing the inner asterisks', () => {
    expect(
      toWhatsAppText('Confirmamos a las *17:00* el *lunes 17 de agosto*?'),
    ).toBe('Confirmamos a las *17:00* el *lunes 17 de agosto*?');
  });

  it('tightens a padded bold that sits between two others', () => {
    expect(toWhatsAppText('Hoy *09:00*, * 12:00 * y *15:00*')).toBe(
      'Hoy *09:00*, *12:00* y *15:00*',
    );
  });

  // WhatsApp only draws a bullet for "- ", so any other marker the model picks would be
  // sent as a literal character in front of the item.
  it('rewrites invented bullet markers as the one WhatsApp renders', () => {
    expect(toWhatsAppText('• Facial\n* Peeling\n  ▪ Masaje')).toBe(
      '- Facial\n- Peeling\n- Masaje',
    );
  });

  it('leaves a bold item at the start of a bullet alone', () => {
    expect(toWhatsAppText('- *Hidrafacial* — 75 min')).toBe(
      '- *Hidrafacial* — 75 min',
    );
  });

  it('keeps one blank line between blocks, never a gap', () => {
    expect(toWhatsAppText('Tenemos esto:\n\n\n\n- Facial\n\n¿Te sirve?')).toBe(
      'Tenemos esto:\n\n- Facial\n\n¿Te sirve?',
    );
  });
});
