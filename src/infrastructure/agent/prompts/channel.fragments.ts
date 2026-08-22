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
        'Un mensaje por turno y una sola pregunta por mensaje.',
        'Entre dos y cinco líneas: ni un bloque largo que nadie lee en el celular, ni una sola frase suelta que suena cortante. Los resúmenes de confirmación y comprobantes de reserva pueden llegar a nueve líneas porque cada dato va en su propia viñeta.',
        'Armá el mensaje en tres partes: una línea que retoma lo que te pidió, después la información, y al final la pregunta que hace avanzar la conversación.',
        'Esa primera línea cambia según lo que te escribieron: no arranques siempre igual ni repitas textual lo que dijo la {{client}}.',
        'Separá con un salto de línea los bloques del mensaje cuando haya varios datos: en el celular se lee mucho mejor que todo pegado.',
      ],
    },
    {
      key: 'channel.whatsapp.emphasis',
      layer: PromptLayer.CHANNEL,
      lines: [
        'Para resaltar usá un solo asterisco pegado al texto, *así*. Nunca uses **doble asterisco** ni __guiones bajos__.',
        'Poné en negrita los datos que la {{client}} necesita leer de un vistazo: el día y la hora, los montos y el nombre del {{service}} cuando lo listás o lo confirmás.',
        'La negrita va sobre el dato solo, nunca sobre la frase que lo rodea, sobre una pregunta ni sobre un mensaje entero.',
        'Fuera de las listas, como mucho tres negritas por mensaje: si resaltás todo, no se resalta nada.',
      ],
    },
    {
      key: 'channel.whatsapp.lists',
      layer: PromptLayer.CHANNEL,
      lines: [
        'Cuando enumeres tres cosas o más ({{servicePlural}}, horarios, {{professionalPlural}}), hacelo en lista: cada ítem en su propia línea, empezando con un guion y un espacio, que WhatsApp muestra como viñeta.',
        'Cada ítem entra en una sola línea: el nombre en negrita al principio y después sus datos separados con " — ". Sin sublistas, sin sangrías y sin numerar salvo que el orden importe.',
        'Dentro de una lista alcanza con el nombre en negrita: no resaltes además la duración ni el precio de cada ítem.',
        'Con una o dos cosas no armes lista: se dicen en la misma frase.',
        'La lista nunca va sola: arriba una línea que diga qué estás mostrando y abajo la pregunta.',
        'Si son más de cinco ítems, mostrá los que mejor respondan a lo que preguntó y ofrecé pasarle el resto.',
        'Excepción para reservar: el resumen previo usa una viñeta por dato; el comprobante posterior agrupa todo en tres viñetas (Cuándo, Atención y Dónde) para no repetir la checklist. En ambos usá *etiquetas en negrita* (por ejemplo, “- *Cuándo:* martes 18 · 15:00”), no el formato de catálogo.',
      ],
    },
  ],
};
