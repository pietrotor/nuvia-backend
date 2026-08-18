import { projectToolResultForModel } from './project-tool-result-for-model';

describe('projectToolResultForModel', () => {
  it('keeps exact-time choices and booking payloads intact', () => {
    const availability = projectToolResultForModel('find_availability', {
      status: 'success',
      summary: '3 horarios',
      nextActions: ['a', 'b', 'c'],
      data: {
        mode: 'resolve_exact_time',
        preferred: null,
        dayLabel: 'martes',
        options: [
          {
            startsAt: '2026-08-18T15:00:00.000Z',
            label: '15:00',
            professionalId: 'p1',
            professionalName: 'Ana',
            branchId: 'b1',
            branchName: 'Centro',
            extra: 'drop-me',
          },
        ],
        unavailableDays: [
          { label: 'domingo', reason: 'closed', detail: 'largo' },
        ],
        nextAvailable: null,
        clientChoosesProfessional: false,
      },
    });

    expect(availability.nextActions).toEqual(['a', 'b']);
    expect(availability.data).toMatchObject({
      dayLabel: 'martes',
      options: [
        {
          label: '15:00',
          professionalId: 'p1',
          branchId: 'b1',
        },
      ],
    });
    expect(
      (availability.data as { unavailableDays: { detail?: string }[] })
        .unavailableDays[0].detail,
    ).toBe('largo');

    const booking = projectToolResultForModel('book_appointment', {
      status: 'success',
      summary: 'ok',
      data: { appointmentId: 'a1', branchId: 'b1' },
    });
    expect(booking.data).toEqual({ appointmentId: 'a1', branchId: 'b1' });
  });

  it('exposes only day parts for broad searches and segments for one day', () => {
    const broad = projectToolResultForModel('find_availability', {
      status: 'success',
      summary: 'días',
      data: {
        mode: 'choose_day_and_period',
        requestedPeriod: null,
        days: Array.from({ length: 10 }, (_, index) => ({
          label: `día ${index}`,
          periods: ['mañana', 'tarde'],
        })),
        options: [{ label: '09:00' }],
        clientChoosesProfessional: true,
      },
    });
    const schedule = projectToolResultForModel('find_availability', {
      status: 'success',
      summary: 'segmentos',
      data: {
        mode: 'show_day_schedule',
        dayLabel: 'martes',
        segments: [
          { kind: 'range', from: '09:00', to: '11:00' },
          { kind: 'times', times: [{ label: '15:15' }] },
        ],
        options: [{ label: '12:00' }],
        clientChoosesProfessional: true,
      },
    });

    expect((broad.data as { days: unknown[] }).days).toHaveLength(7);
    expect(broad.data).not.toHaveProperty('options');
    expect(schedule.data).toMatchObject({
      mode: 'show_day_schedule',
      dayLabel: 'martes',
      segments: [
        { kind: 'range', from: '09:00', to: '11:00' },
        { kind: 'times', times: [{ label: '15:15' }] },
      ],
    });
    expect(schedule.data).not.toHaveProperty('options');
  });
});
