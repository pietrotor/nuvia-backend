import { Injectable } from '@nestjs/common';

import { ClientReminderCopyPort } from '@domain/reminders/ports/client-reminder-copy.port';
import { ClientReminderCopyInput } from '@domain/reminders/ports/client-reminder-copy.port';
import { AppointmentReminderKind } from '@domain/reminders/value-objects/appointment-reminder-kind.vo';

@Injectable()
export class ClientReminderCopyAdapter implements ClientReminderCopyPort {
  render(input: ClientReminderCopyInput): string {
    if (input.kind === AppointmentReminderKind.THANK_YOU) {
      return [
        `Hola, soy ${input.agentName}. Gracias por visitarnos hoy.`,
        'Te esperamos de nuevo cuando quieras.',
      ].join('\n');
    }

    if (input.depositPending) {
      return [
        `Hola, soy ${input.agentName}. Tu turno de ${input.serviceName} para el ${input.startsAtLabel} sigue esperando la seña.`,
        '',
        'Mandame el comprobante por acá. Si no te llegó el QR, pedime y te lo reenvío.',
      ].join('\n');
    }

    return [
      `Hola, soy ${input.agentName}. Te recuerdo tu cita:`,
      '',
      `• *Servicio:* ${input.serviceName}`,
      `• *Profesional:* ${input.professionalName}`,
      `• *Sucursal:* ${input.branchName}`,
      `• *Cuándo:* ${input.startsAtLabel}`,
      '',
      'Si no podés, escribime y te busco otro horario.',
    ].join('\n');
  }
}
