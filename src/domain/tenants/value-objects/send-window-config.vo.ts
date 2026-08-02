export interface TimeWindow {
  from: string;
  to: string;
}

export interface SendWindowConfig {
  windows: TimeWindow[];
  blockedWeekdays: number[];
  sundayFrom?: string;
}

export const DEFAULT_SEND_WINDOW_CONFIG: SendWindowConfig = {
  windows: [
    { from: '09:30', to: '11:00' },
    { from: '19:00', to: '20:30' },
  ],
  blockedWeekdays: [],
  sundayFrom: '10:00',
};
