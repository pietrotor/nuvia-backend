import { DateTime } from 'luxon';

// The clock time as the business reads it. Formatting an instant in UTC would authorise a
// time nobody said, and leave the one the agent is meant to write out in the cold.
export function clockLabel(at: Date, timezone: string): string {
  return DateTime.fromJSDate(at).setZone(timezone).toFormat('HH:mm');
}
