import { SlotOption } from '@application/appointments/use-cases/find-availability-options.use-case';
import {
  AvailabilityDayPart,
  buildAvailabilitySegments,
  filterSlotsByDayPart,
  summarizeAvailabilityDays,
} from './availability-presentation';

const TIMEZONE = 'America/La_Paz';

function slot(localIso: string): SlotOption {
  return {
    startsAt: new Date(localIso),
    professionalId: 'professional-1',
    professionalName: 'Camila',
    branchId: 'branch-1',
    branchName: 'Centro',
  };
}

describe('availability presentation', () => {
  it('uses noon and 18:00 as deterministic day-part boundaries', () => {
    const slots = [
      slot('2026-08-10T11:45:00-04:00'),
      slot('2026-08-10T12:00:00-04:00'),
      slot('2026-08-10T17:45:00-04:00'),
      slot('2026-08-10T18:00:00-04:00'),
    ];

    expect(
      filterSlotsByDayPart(slots, AvailabilityDayPart.MORNING, TIMEZONE),
    ).toEqual([slots[0]]);
    expect(
      filterSlotsByDayPart(slots, AvailabilityDayPart.AFTERNOON, TIMEZONE),
    ).toEqual([slots[1], slots[2]]);
    expect(
      filterSlotsByDayPart(slots, AvailabilityDayPart.EVENING, TIMEZONE),
    ).toEqual([slots[3]]);
  });

  it('summarizes each day without leaking exact clock times', () => {
    const days = summarizeAvailabilityDays(
      [
        slot('2026-08-10T09:00:00-04:00'),
        slot('2026-08-10T14:00:00-04:00'),
        slot('2026-08-11T18:00:00-04:00'),
      ],
      TIMEZONE,
    );

    expect(days.map((day) => day.dayParts)).toEqual([
      [AvailabilityDayPart.MORNING, AvailabilityDayPart.AFTERNOON],
      [AvailabilityDayPart.EVENING],
    ]);
  });

  it('turns three consecutive starts into a range', () => {
    const slots = [
      slot('2026-08-10T09:00:00-04:00'),
      slot('2026-08-10T09:15:00-04:00'),
      slot('2026-08-10T09:30:00-04:00'),
    ];

    expect(buildAvailabilitySegments(slots)).toEqual([
      {
        kind: 'range',
        firstStart: slots[0],
        lastStart: slots[2],
      },
    ]);
  });

  it('keeps one or two starts explicit and splits around real gaps', () => {
    const slots = [
      slot('2026-08-10T09:00:00-04:00'),
      slot('2026-08-10T09:15:00-04:00'),
      slot('2026-08-10T11:00:00-04:00'),
      slot('2026-08-10T13:00:00-04:00'),
      slot('2026-08-10T13:15:00-04:00'),
      slot('2026-08-10T13:30:00-04:00'),
    ];

    expect(buildAvailabilitySegments(slots)).toEqual([
      { kind: 'times', slots: slots.slice(0, 2) },
      { kind: 'times', slots: [slots[2]] },
      {
        kind: 'range',
        firstStart: slots[3],
        lastStart: slots[5],
      },
    ]);
  });
});
