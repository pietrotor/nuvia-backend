import { DateTime } from 'luxon';

import {
  FALLBACK_NOTIFICATION_TIMEZONE,
  NOTIFICATION_EMERGENCY_WINDOW_HOURS,
  NOTIFICATION_QUIET_END_HOUR,
  NOTIFICATION_QUIET_RESUME_MINUTE,
  NOTIFICATION_QUIET_START_HOUR,
} from '../services/notification-limits';

export function isQuietHour(now: Date, timezone: string): boolean {
  const hour = DateTime.fromJSDate(now, { zone: timezone }).hour;
  return (
    hour >= NOTIFICATION_QUIET_START_HOUR || hour < NOTIFICATION_QUIET_END_HOUR
  );
}

export function nextQuietResumeAt(now: Date, timezone: string): Date {
  const local = DateTime.fromJSDate(now, { zone: timezone });
  const todayResume = local.set({
    hour: NOTIFICATION_QUIET_END_HOUR,
    minute: NOTIFICATION_QUIET_RESUME_MINUTE,
    second: 0,
    millisecond: 0,
  });
  const resume =
    local < todayResume ? todayResume : todayResume.plus({ days: 1 });
  const jitterMinutes = Math.floor(Math.random() * 10);
  return resume.plus({ minutes: jitterMinutes }).toUTC().toJSDate();
}

export function isEmergencyWindow(startsAt: Date, now: Date): boolean {
  return (
    startsAt.getTime() - now.getTime() <=
      NOTIFICATION_EMERGENCY_WINDOW_HOURS * 60 * 60 * 1000 &&
    startsAt.getTime() >= now.getTime()
  );
}

export function notificationTimezone(
  branchTimezone: string | null | undefined,
  tenantTimezone: string | null | undefined,
): string {
  return branchTimezone || tenantTimezone || FALLBACK_NOTIFICATION_TIMEZONE;
}
