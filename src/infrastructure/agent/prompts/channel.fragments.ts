import {
  PromptChannel,
  PromptFragment,
  PromptLayer,
} from '@domain/agent/prompt/prompt-fragment';

// The single source for how the agent is told to format text. What actually guarantees it
// is `toWhatsAppText`, which normalizes the answer before sending it.
export const CHANNEL_FRAGMENTS: Record<PromptChannel, PromptFragment[]> = {
  [PromptChannel.WHATSAPP]: [
    {
      key: 'channel.whatsapp',
      layer: PromptLayer.CHANNEL,
      lines: [
        'CANAL — WhatsApp.',
        'Texto plano: sin Markdown, sin encabezados (#) y sin tablas.',
        'Para resaltar usá un solo asterisco pegado al texto, *así*. Nunca uses **doble asterisco** ni __guiones bajos__.',
        'Resaltá poco: una o dos palabras, y solo cuando ayuden a leer.',
        'Respuestas cortas, de pocas líneas. Si enumerás, usá guiones.',
        'Un mensaje por turno y una sola pregunta por mensaje.',
      ],
    },
  ],
};
