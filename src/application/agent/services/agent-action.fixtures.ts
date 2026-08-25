import { AgentCommittedAction } from '@domain/agent/services/agent-action';

export function bookedAction(
  overrides: Partial<AgentCommittedAction> = {},
): AgentCommittedAction {
  return {
    operation: 'appointment.book',
    resourceType: 'appointment',
    resourceId: 'ap1',
    outcome: 'committed',
    facts: {
      status: 'confirmed',
      dateLabel: 'miércoles 26 de agosto',
      startsAtLabel: '17:00',
      serviceName: 'Masaje relajante 60 min',
      professionalName: 'Valeria Mamani',
      attendeeName: 'Pietro',
      branchName: 'Casa Matriz',
      awaitsDeposit: false,
    },
    ...overrides,
  };
}

export function cancelledAction(
  overrides: Partial<AgentCommittedAction> = {},
): AgentCommittedAction {
  return {
    operation: 'appointment.cancel',
    resourceType: 'appointment',
    resourceId: 'ap1',
    outcome: 'committed',
    facts: {
      status: 'cancelled',
      dateLabel: 'miércoles 26 de agosto',
      startsAtLabel: '17:00',
      serviceName: 'Masaje relajante 60 min',
      professionalName: 'Valeria Mamani',
      attendeeName: 'Pietro',
      depositAtRisk: false,
    },
    ...overrides,
  };
}
