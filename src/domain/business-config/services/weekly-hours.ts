import { DayHours, WeeklyHours } from '../entities/business-config.entity';

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
