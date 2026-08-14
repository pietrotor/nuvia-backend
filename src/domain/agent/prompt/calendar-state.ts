import { DateTime } from 'luxon';

// The next two weeks spelled out, weekday by weekday. Given only "hoy es sábado 8 de
// agosto", the model does the calendar arithmetic itself and gets it wrong: it read "el
// martes de la siguiente semana" as the 19th (a Wednesday) and booked an appointment
// nobody asked for. Reading the day off a list is not arithmetic.
export const CALENDAR_DAYS = 14;

export function renderCalendar(
  reference: Date,
  timezone: string,
  days: number = CALENDAR_DAYS,
): string {
  const start = DateTime.fromJSDate(reference, { zone: timezone }).setLocale(
    'es',
  );
  if (!start.isValid) return '';

  return Array.from({ length: days }, (_, offset) =>
    start.plus({ days: offset }).toFormat("cccc d 'de' LLLL"),
  ).join(', ');
}
