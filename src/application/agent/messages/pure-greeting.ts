// Pure greeting only: "hola", "buenas tardes", with optional punctuation/emoji.
// Compound messages ("hola, quiero manicure") must keep going to the LLM.
const PURE_GREETING =
  /^\s*(hola|holi|holaa+|buen[oa]s(?:\s+(?:d[ií]as|tardes|noches))?|buen d[ií]a|hey|hi|hello)(?:\s*[!.🙂😊👋]*)?\s*$/iu;

export function isPureGreeting(text: string | null | undefined): boolean {
  if (!text) return false;
  return PURE_GREETING.test(text.normalize('NFC'));
}

export function greetingReply(agentName: string): string {
  return `¡Hola! Soy ${agentName}, el asistente virtual del negocio. ¿En qué te puedo ayudar?`;
}
