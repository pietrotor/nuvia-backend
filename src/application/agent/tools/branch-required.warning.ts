import { AgentToolResult } from './agent-tool';

// Returned when a multi-branch tenant has no location pinned on the conversation.
export function branchRequiredWarning(): AgentToolResult {
  return {
    status: 'warning',
    summary:
      'Hay más de una sucursal activa y todavía no se eligió una para esta conversación.',
    nextActions: [
      'Llamar a list_branches y preguntarle a la clienta en cuál quiere atenderse.',
      'Después de que elija, llamar a set_branch con el id de esa sucursal.',
    ],
  };
}
