/**
 * Normalizes LLM / markdown text to WhatsApp-friendly formatting.
 * WhatsApp bold is a single pair of asterisks with no spaces: *texto*
 * Markdown **texto** leaves visible asterisks on many clients.
 * A list item only renders as a bullet when the line starts with "- " and no indentation.
 * An asterisk only opens bold where a word starts and only closes where one ends: pairing
 * them by proximity instead turns "*17:00* el *lunes*" into "*17:00*el*lunes*", gluing the
 * words together and bolding the wrong half.
 */
export function toWhatsAppText(text: string): string {
  return text
    .replace(/\*\*(.+?)\*\*/gs, '*$1*')
    .replace(/__(.+?)__/gs, '*$1*')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(
      /(^|[\s(¿¡"'])\*[ \t]*([^*\n]+?)[ \t]*\*(?=$|[\s.,;:!?)"'])/gm,
      '$1*$2*',
    )
    .replace(/^[ \t]*[•·▪◦*][ \t]+(?=\S)/gm, '- ')
    .replace(/^[ \t]+|[ \t]+$/gm, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}
