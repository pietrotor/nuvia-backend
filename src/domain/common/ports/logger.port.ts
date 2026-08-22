export interface LoggerPort {
  log?(message: string, context?: string): void;
  error(message: string, trace?: string, context?: string): void;
  warn(message: string, context?: string): void;
}

export const LOGGER_PORT = 'LoggerPort';
