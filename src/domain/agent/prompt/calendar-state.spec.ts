import { CALENDAR_DAYS, renderCalendar } from './calendar-state';

const LA_PAZ = 'America/La_Paz';

describe('renderCalendar', () => {
  // Saturday 8 August 2026, 19:00 in La Paz.
  const saturday = new Date('2026-08-08T23:00:00.000Z');

  it('starts on the reference day and spans a fortnight', () => {
    const days = renderCalendar(saturday, LA_PAZ).split(', ');

    expect(days).toHaveLength(CALENDAR_DAYS);
    expect(days[0]).toBe('sábado 8 de agosto');
    expect(days.at(-1)).toBe('viernes 21 de agosto');
  });

  // The agent read "el martes de la siguiente semana" as the 19th and booked an
  // appointment nobody asked for; it then insisted the Tuesday was the 12th.
  it('pins down the days the agent got wrong', () => {
    const days = renderCalendar(saturday, LA_PAZ);

    expect(days).toContain('martes 11 de agosto');
    expect(days).toContain('miércoles 12 de agosto');
    expect(days).toContain('miércoles 19 de agosto');
    expect(days).not.toContain('martes 12 de agosto');
    expect(days).not.toContain('martes 19 de agosto');
  });

  // That instant is already Sunday in Madrid but still Saturday in La Paz, and the client
  // asking for "mañana" means the business's tomorrow.
  it('reads the day in the timezone of the business', () => {
    expect(renderCalendar(saturday, 'Europe/Madrid')).toMatch(
      /^domingo 9 de agosto/,
    );
    expect(renderCalendar(saturday, LA_PAZ)).toMatch(/^sábado 8 de agosto/);
  });

  it('renders nothing for a timezone the tenant got wrong, so the fragment is dropped', () => {
    expect(renderCalendar(saturday, 'Mars/Olympus')).toBe('');
  });
});
