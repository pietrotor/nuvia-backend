/**
 * Normalizes LLM / markdown text to WhatsApp-friendly formatting.
 * WhatsApp bold is a single pair of asterisks with no spaces: *texto*
 * Markdown **texto** leaves visible asterisks on many clients.
 */
export function toWhatsAppText(text: string): string {
  return text
    .replace(/\*\*(.+?)\*\*/gs, '*$1*')
    .replace(/__(.+?)__/gs, '*$1*')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/\*\s+([^*\n]+?)\s+\*/g, '*$1*')
    .replace(/^[ \t]+|[ \t]+$/gm, '')
    .trim();
}
