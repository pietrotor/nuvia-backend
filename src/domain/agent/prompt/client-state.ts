// What the schedule says about this client right now, rendered for the volatile block of
// the prompt. The conversation history replays our own outbound messages as assistant
// turns with no trace of which tools ran, so a model that once claimed a booking reads
// that claim back as a fact. This states the ground truth next to it.
export interface ClientStateAppointment {
  // Restated every turn for the same reason the catalog restates service ids: the tool
  // result that produced it is gone by the next inbound, and a model asked to act on a
  // booking with no id at hand reaches for the nearest plausible uuid in the prompt.
  appointmentId: string;
  service: string;
  professional: string;
  whenLabel: string;
  awaitingDeposit: boolean;
  attendeeName?: string | null;
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
          appointment.attendeeName
            ? ` a nombre de ${appointment.attendeeName}`
            : ''
        }${appointment.awaitingDeposit ? ' (esperando la seña)' : ''} — id ${appointment.appointmentId}`,
    ),
  ].join('\n');
}
