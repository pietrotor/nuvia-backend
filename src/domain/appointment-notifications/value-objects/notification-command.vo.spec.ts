import { parseNotificationCommand } from './notification-command.vo';
import { NotificationCommandKind } from './notification-command.vo';

describe('parseNotificationCommand', () => {
  it('parses activation with a six-character code', () => {
    expect(parseNotificationCommand('activar ab12cd')).toEqual({
      kind: NotificationCommandKind.ACTIVATE,
      activationCode: 'AB12CD',
    });
  });

  it('parses pause, resume and opt-out without invoking the agent', () => {
    expect(parseNotificationCommand('PAUSAR')?.kind).toBe(
      NotificationCommandKind.PAUSE,
    );
    expect(parseNotificationCommand('reanudar')?.kind).toBe(
      NotificationCommandKind.RESUME,
    );
    expect(parseNotificationCommand('baja')?.kind).toBe(
      NotificationCommandKind.OPT_OUT,
    );
    expect(parseNotificationCommand('STOP')?.kind).toBe(
      NotificationCommandKind.OPT_OUT,
    );
  });

  it('ignores ordinary client copy', () => {
    expect(parseNotificationCommand('Hola, quiero una cita')).toBeNull();
  });
});
