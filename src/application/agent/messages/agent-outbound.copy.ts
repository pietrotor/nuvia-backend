export const AgentOutboundCopy = {
  nonTextInbound:
    'Por acá te puedo ayudar mejor por texto. Mandame un mensajito escrito con lo que necesitás (agendar, precios, reagendar, etc.).',

  handoffAutoResumeBridge(agentName: string): string {
    return `El equipo todavía no pudo atenderte. Te sigo ayudando yo. Soy ${agentName}.`;
  },

  // Sent when the model produced no usable text (empty, or cut by the token budget). It
  // promises a handoff, so the orchestrator must actually request one before sending it.
  incompleteConsultation:
    'No pude completar la consulta. Te derivo con el equipo.',

  needsHumanContinuation:
    'Necesito que una persona continúe esta consulta. Ya aviso al equipo.',

  // Replaces an answer that announced a booking the agenda never received. Better an
  // honest correction than a client showing up to a turn that does not exist.
  unverifiedBooking:
    'Perdón, me adelanté: no pude dejar la reserva hecha. Le paso tu pedido al equipo para que lo confirmen con vos.',

  // Replaces an answer that kept offering hours the agenda never gave back. Sending it as
  // written would put the client in front of a slot that does not exist.
  unverifiedSchedule:
    'Perdón, me hice un lío con los horarios y prefiero no pasarte uno equivocado. Le aviso al equipo para que te confirmen los que están libres.',

  unverifiedDepositQr:
    'Perdón, no pude enviarte el QR desde acá. Ya aviso al equipo para que te pasen los datos del pago.',

  unverifiedCancellation:
    'Perdón, me adelanté: todavía no pude cancelar la cita en la agenda. Le paso tu pedido al equipo para que lo confirmen con vos.',

  unverifiedReschedule:
    'Perdón, me adelanté: todavía no pude cambiar el horario en la agenda. Le paso tu pedido al equipo para que lo confirmen con vos.',

  unverifiedDepositReceipt:
    'Perdón, no pude registrar el comprobante desde acá. Ya aviso al equipo para que lo revisen con vos.',

  unverifiedHandoff:
    'Perdón, todavía no pude avisar al equipo. Intentá de nuevo en un momento o escribí “quiero hablar con una persona”.',

  unverifiedClientName:
    'Perdón, todavía no pude guardar tu nombre. Decime cómo te llamás otra vez y lo anoto bien.',

  unverifiedBranch:
    'Perdón, todavía no pude fijar la sucursal. Decime de nuevo en cuál querés atenderte.',

  unverifiedPayment:
    'El pago de la seña lo confirma el equipo cuando revisa el comprobante. Todavía no figura como verificado; ya les aviso.',

  // Provider outage / misconfiguration: never invent an answer, and leave the thread with a human.
  llmUnavailable:
    'Estoy con un problema técnico en este momento. Ya aviso al equipo para que te continúe la conversación.',
} as const;
