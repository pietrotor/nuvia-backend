export enum NotificationCommandKind {
  ACTIVATE = 'activate',
  PAUSE = 'pause',
  RESUME = 'resume',
  OPT_OUT = 'opt_out',
}

export interface ParsedNotificationCommand {
  kind: NotificationCommandKind;
  activationCode?: string;
}

const WHITESPACE = /\s+/g;

export function parseNotificationCommand(
  content: string | null,
): ParsedNotificationCommand | null {
  if (!content) return null;
  const normalized = content.trim().replace(WHITESPACE, ' ').toUpperCase();
  if (!normalized) return null;

  if (normalized === 'PAUSAR') {
    return { kind: NotificationCommandKind.PAUSE };
  }
  if (normalized === 'REANUDAR') {
    return { kind: NotificationCommandKind.RESUME };
  }
  if (normalized === 'BAJA' || normalized === 'STOP') {
    return { kind: NotificationCommandKind.OPT_OUT };
  }

  const activate = /^ACTIVAR ([A-Z0-9]{6})$/.exec(normalized);
  if (activate) {
    return {
      kind: NotificationCommandKind.ACTIVATE,
      activationCode: activate[1],
    };
  }

  return null;
}
