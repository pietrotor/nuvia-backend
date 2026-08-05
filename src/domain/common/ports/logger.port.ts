export interface LoggerPort {
  error(message: string, trace?: string, context?: string): void;
}

export const LOGGER_PORT = 'LoggerPort';
