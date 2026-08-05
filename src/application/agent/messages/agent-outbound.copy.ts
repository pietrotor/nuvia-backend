export const AgentOutboundCopy = {
  nonTextInbound:
    'Por acá te puedo ayudar mejor por texto. Mandame un mensajito escrito con lo que necesitás (agendar, precios, reagendar, etc.).',

  handoffAutoResumeBridge(agentName: string): string {
    return `El equipo todavía no pudo atenderte. Te sigo ayudando yo. Soy ${agentName}.`;
  },

  incompleteConsultation:
    'No pude completar la consulta. Te derivo con el equipo.',

  needsHumanContinuation:
    'Necesito que una persona continúe esta consulta. Ya aviso al equipo.',
} as const;
