import { mergeFreeWindows, pickSpreadSlots } from './slot-offering';

const TIMEZONE = 'America/La_Paz';

// Monday 10 August 2026 in La Paz: local HH:mm → UTC Date.
function at(localHm: string): Date {
  const [hour, minute] = localHm.split(':').map(Number);
  return new Date(Date.UTC(2026, 7, 10, hour + 4, minute));
}

function slotsEvery15(
  fromHm: string,
  toHmExclusive: string,
): { startsAt: Date }[] {
  const starts: { startsAt: Date }[] = [];
  let cursor = at(fromHm).getTime();
  const end = at(toHmExclusive).getTime();
  while (cursor < end) {
    starts.push({ startsAt: new Date(cursor) });
    cursor += 15 * 60_000;
  }
  return starts;
}

describe('mergeFreeWindows', () => {
  it('collapses a full free day into one bookable-start window', () => {
    const slots = slotsEvery15('09:00', '17:00');
    // Last start 16:45 would be for a shorter service; with 60 min the last start is 17:00.
    const withLast = [...slots, { startsAt: at('17:00') }];

    expect(mergeFreeWindows(withLast, 60)).toEqual([
      { firstStart: at('09:00'), lastStart: at('17:00') },
    ]);
  });

  it('splits around a booking and exposes lastStart per window, not the occupancy edge', () => {
    // Free starts 09:00–11:00 and 13:00–17:00 for a 60-minute service.
    const morning = [
      '09:00',
      '09:15',
      '09:30',
      '09:45',
      '10:00',
      '10:15',
      '10:30',
      '10:45',
      '11:00',
    ].map((hm) => ({ startsAt: at(hm) }));
    const afternoon = [
      '13:00',
      '13:15',
      '13:30',
      '13:45',
      '14:00',
      '14:15',
      '14:30',
      '14:45',
      '15:00',
      '15:15',
      '15:30',
      '15:45',
      '16:00',
      '16:15',
      '16:30',
      '16:45',
      '17:00',
    ].map((hm) => ({ startsAt: at(hm) }));

    expect(mergeFreeWindows([...morning, ...afternoon], 60)).toEqual([
      { firstStart: at('09:00'), lastStart: at('11:00') },
      { firstStart: at('13:00'), lastStart: at('17:00') },
    ]);
  });

  it('returns a single start when only one slot fits before a booking', () => {
    // Appointment at 10:00 for 45 min → only 09:00 and 09:15 are free.
    expect(
      mergeFreeWindows(
        [{ startsAt: at('09:00') }, { startsAt: at('09:15') }],
        45,
      ),
    ).toEqual([{ firstStart: at('09:00'), lastStart: at('09:15') }]);
  });

  it('returns nothing when there are no free slots', () => {
    expect(mergeFreeWindows([], 60)).toEqual([]);
  });
});

describe('pickSpreadSlots', () => {
  const day = slotsEvery15('09:00', '17:15'); // last start 17:00

  it('returns every slot when there are fewer than the limit', () => {
    const few = [{ startsAt: at('09:00') }, { startsAt: at('10:00') }];
    expect(pickSpreadSlots(few, 4, TIMEZONE)).toEqual(few);
  });

  it('spreads offers across the day instead of taking the first N', () => {
    const picked = pickSpreadSlots(day, 4, TIMEZONE);
    const hours = picked.map((slot) =>
      slot.startsAt.toISOString().slice(11, 16),
    );

    expect(picked).toHaveLength(4);
    // Not the consecutive quarter-hours that used to leak out of the 15-minute grid.
    expect(hours).not.toEqual(['13:00', '13:15', '13:30', '13:45']);
    expect(picked[0].startsAt.toISOString()).toBe(at('09:00').toISOString());
    expect(picked[picked.length - 1].startsAt.getTime()).toBeGreaterThan(
      at('14:00').getTime(),
    );
  });

  it('prefers round hours over quarter-hours near each target', () => {
    const mixed = [
      { startsAt: at('09:00') },
      { startsAt: at('09:15') },
      { startsAt: at('09:30') },
      { startsAt: at('09:45') },
      { startsAt: at('12:00') },
      { startsAt: at('12:15') },
      { startsAt: at('15:00') },
      { startsAt: at('15:15') },
      { startsAt: at('17:00') },
      { startsAt: at('17:15') },
    ];

    const picked = pickSpreadSlots(mixed, 4, TIMEZONE);
    const minutes = picked.map((slot) =>
      new Date(slot.startsAt.getTime() - 4 * 3_600_000).getUTCMinutes(),
    );

    expect(minutes.every((minute) => minute === 0 || minute === 30)).toBe(true);
  });
});
