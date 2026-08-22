export enum AppointmentReminderKind {
  OFFSET_24H = '24h',
  OFFSET_12H = '12h',
  OFFSET_2H = '2h',
  OFFSET_30M = '30m',
  THANK_YOU = 'thank_you',
}

export const PRE_VISIT_REMINDER_KINDS: AppointmentReminderKind[] = [
  AppointmentReminderKind.OFFSET_24H,
  AppointmentReminderKind.OFFSET_12H,
  AppointmentReminderKind.OFFSET_2H,
  AppointmentReminderKind.OFFSET_30M,
];
