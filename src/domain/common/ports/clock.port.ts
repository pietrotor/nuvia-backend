export interface ClockPort {
  now(): Date;
}

export const CLOCK_PORT = 'ClockPort';
