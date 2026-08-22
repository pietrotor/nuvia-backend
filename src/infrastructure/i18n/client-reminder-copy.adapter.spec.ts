import { AppointmentReminderKind } from '@domain/reminders/value-objects/appointment-reminder-kind.vo';
import { ClientReminderCopyAdapter } from './client-reminder-copy.adapter';

describe('ClientReminderCopyAdapter', () => {
  const adapter = new ClientReminderCopyAdapter();

  it('names the agent and invites the client to reply to reschedule', () => {
    const text = adapter.render({
      reminderId: 'r1',
      kind: AppointmentReminderKind.OFFSET_24H,
      agentName: 'Luna',
      serviceName: 'Limpieza',
      professionalName: 'Camila',
      branchName: 'Centro',
      startsAtLabel: 'vie 21 ago, 11:00',
      depositPending: false,
    });

    expect(text).toContain('Luna');
    expect(text).toContain('Limpieza');
    expect(text).toContain('Camila');
    expect(text).toContain('Centro');
    expect(text).toContain('vie 21 ago, 11:00');
    expect(text).toMatch(/escribime y te busco otro horario/i);
  });

  it('renders a thank-you without medical advice', () => {
    const text = adapter.render({
      reminderId: 'r2',
      kind: AppointmentReminderKind.THANK_YOU,
      agentName: 'Luna',
      serviceName: 'Peeling',
      professionalName: 'Camila',
      branchName: 'Centro',
      startsAtLabel: 'vie 21 ago, 11:00',
      depositPending: false,
    });

    expect(text).toContain('Luna');
    expect(text).toMatch(/gracias/i);
    expect(text.toLowerCase()).not.toMatch(/diagnóstico|tratamiento médico/);
  });

  it('asks for the receipt without embedding or promising another QR', () => {
    const text = adapter.render({
      reminderId: 'r3',
      kind: AppointmentReminderKind.OFFSET_2H,
      agentName: 'Luna',
      serviceName: 'Limpieza',
      professionalName: 'Camila',
      branchName: 'Centro',
      startsAtLabel: 'vie 21 ago, 11:00',
      depositPending: true,
    });

    expect(text).toMatch(/sigue esperando la seña/i);
    expect(text).toMatch(/mandame el comprobante/i);
    expect(text).toMatch(/pedime y te lo reenvío/i);
  });
});
