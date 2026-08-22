import { Injectable } from '@nestjs/common';

import { AppointmentNotificationCopyPort } from '@domain/appointment-notifications/ports/appointment-notification-copy.port';
import { AppointmentNotificationAlertCopyInput } from '@domain/appointment-notifications/ports/appointment-notification-copy.port';
import { AppointmentNotificationKind } from '@domain/appointment-notifications/value-objects/appointment-notification-kind.vo';
import { NotificationCommandKind } from '@domain/appointment-notifications/value-objects/notification-command.vo';

const OPENINGS = [
  'Hola, aviso de agenda:',
  'Te cuento un cambio en la agenda:',
  'Actualización de cita:',
] as const;

const KIND_LABEL: Record<AppointmentNotificationKind, string> = {
  [AppointmentNotificationKind.BOOKED]: 'Nueva cita',
  [AppointmentNotificationKind.RESCHEDULED]: 'Cita reagendada',
  [AppointmentNotificationKind.CANCELLED]: 'Cita cancelada',
};

const HANDSHAKE: Record<NotificationCommandKind, string> = {
  [NotificationCommandKind.ACTIVATE]:
    'Listo. Desde ahora vas a recibir avisos automáticos de citas de Nuvi. Para pausarlos escribí PAUSAR. Para darte de baja, BAJA.',
  [NotificationCommandKind.PAUSE]:
    'Pausamos los avisos. Cuando quieras reanudarlos, escribí REANUDAR.',
  [NotificationCommandKind.RESUME]:
    'Reanudamos los avisos automáticos de citas.',
  [NotificationCommandKind.OPT_OUT]:
    'Ya no vas a recibir avisos automáticos de citas. Si fue un error, pedile a la dueña que te vuelva a configurar.',
};

@Injectable()
export class AppointmentNotificationCopyAdapter
  implements AppointmentNotificationCopyPort
{
  renderAlert(input: AppointmentNotificationAlertCopyInput): string {
    const opening = OPENINGS[this.variantIndex(input.eventId)];
    const kind = KIND_LABEL[input.kind];
    const lines = [
      `${opening} *${kind}*`,
      '',
      `• *Clienta:* ${input.clientDisplayName}`,
      `• *Servicio:* ${input.serviceName}`,
      input.previousStartsAtLabel
        ? `• *Antes:* ${input.previousStartsAtLabel}`
        : null,
      `• *Cuándo:* ${input.startsAtLabel}`,
      `• *Profesional:* ${input.professionalName}`,
      `• *Sucursal:* ${input.branchName}`,
    ].filter((line): line is string => line !== null);

    if (input.isDigest && input.digestCount && input.digestCount > 1) {
      lines.push(
        '',
        `Resumen de ${input.digestCount} cambios recientes. Este es el estado actual.`,
      );
    }

    lines.push('', '_Aviso automático de Nuvi_');
    return lines.join('\n');
  }

  handshakeReply(kind: NotificationCommandKind): string {
    return HANDSHAKE[kind];
  }

  private variantIndex(eventId: string): number {
    let hash = 0;
    for (let i = 0; i < eventId.length; i += 1) {
      hash = (hash + eventId.charCodeAt(i) * (i + 1)) % OPENINGS.length;
    }
    return hash;
  }
}
