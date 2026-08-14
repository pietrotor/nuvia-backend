// What the schedule says about this client right now, rendered for the volatile block of
// the prompt. The conversation history replays our own outbound messages as assistant
// turns with no trace of which tools ran, so a model that once claimed a booking reads
// that claim back as a fact. This states the ground truth next to it.
export interface ClientStateAppointment {
  service: string;
  professional: string;
  whenLabel: string;
  awaitingDeposit: boolean;
}

export function renderClientState(
  appointments: ClientStateAppointment[],
): string {
  if (appointments.length === 0) {
    return 'no tiene ninguna reserva registrada';
  }

  return [
    'tiene estas reservas registradas:',
    ...appointments.map(
      (appointment) =>
        `- ${appointment.service} con ${appointment.professional}, ${appointment.whenLabel}${
          appointment.awaitingDeposit ? ' (esperando la seña)' : ''
        }`,
    ),
  ].join('\n');
}
