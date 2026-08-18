import { AgentToolResult } from './agent-tool';

// Returned when a multi-branch tenant has no location pinned on the conversation.
export function branchRequiredWarning(): AgentToolResult {
  return {
    status: 'warning',
    summary:
      'Hay más de una sucursal activa y hace falta elegir una para completar esta acción.',
    nextActions: [
      'Si el servicio o el horario ya apuntan a una sola sucursal, usá esa.',
      'Si hay varias opciones, preguntarle a la clienta en cuál quiere atenderse y llamar a set_branch.',
    ],
  };
}
