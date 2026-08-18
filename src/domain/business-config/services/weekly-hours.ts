import { DayHours, WeeklyHours } from '../entities/business-config.entity';

const DAY_NAMES: Record<keyof WeeklyHours, string> = {
  mon: 'lunes',
  tue: 'martes',
  wed: 'miércoles',
  thu: 'jueves',
  fri: 'viernes',
  sat: 'sábado',
  sun: 'domingo',
};

export function intersectWeeklyHours(
  businessHours: WeeklyHours,
  professionalHours: WeeklyHours,
): WeeklyHours {
  const result = {} as WeeklyHours;

  for (const key of Object.keys(businessHours) as (keyof WeeklyHours)[]) {
    const business = businessHours[key];
    const professional = professionalHours[key];
    result[key] =
      business && professional ? intersectDay(business, professional) : null;
  }

  return result;
}

function intersectDay(a: DayHours, b: DayHours): DayHours | null {
  const start = a.start > b.start ? a.start : b.start;
  const end = a.end < b.end ? a.end : b.end;
  return start < end ? { start, end } : null;
}

// The days worked at all, for a reader rather than a calculation. Bookable slots inside
// those days still come from the availability calculator.
export function describeWorkingDays(weeklyHours: WeeklyHours): string[] {
  return (Object.keys(DAY_NAMES) as (keyof WeeklyHours)[]).flatMap((day) => {
    const hours = weeklyHours[day];
    return hours ? [`${DAY_NAMES[day]} ${hours.start} a ${hours.end}`] : [];
  });
}

// Day names only — clock times in the catalog invite the model to invent free slots.
export function describeWorkingDayNames(weeklyHours: WeeklyHours): string[] {
  return (Object.keys(DAY_NAMES) as (keyof WeeklyHours)[]).flatMap((day) =>
    weeklyHours[day] ? [DAY_NAMES[day]] : [],
  );
}

export function hasAnyOpenDay(weeklyHours: WeeklyHours): boolean {
  return (Object.keys(DAY_NAMES) as (keyof WeeklyHours)[]).some(
    (day) => weeklyHours[day] !== null,
  );
}
