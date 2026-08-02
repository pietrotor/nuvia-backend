import { utilities as nestWinstonModuleUtilities } from 'nest-winston';
import * as winston from 'winston';
// El paquete usa `export =`, así que el import por default depende del helper de interop
// que tsc emite y los transpiladores on-the-fly (p. ej. Console Ninja) no siempre agregan.
import DailyRotateFile = require('winston-daily-rotate-file');

export const winstonConfig = {
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
        winston.format.ms(),
        nestWinstonModuleUtilities.format.nestLike('CobrAI', {
          colors: true,
          prettyPrint: true,
        }),
      ),
    }),

    new DailyRotateFile({
      dirname: 'logs',
      filename: 'application-%DATE%.log',
      datePattern: 'YYYY-MM-DD',
      zippedArchive: true,
      maxSize: '20m',
      maxFiles: '14d',
      format: winston.format.combine(
        winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
        winston.format.errors({ stack: true }),
        winston.format.splat(),
        winston.format.json(),
      ),
    }),

    new DailyRotateFile({
      dirname: 'logs',
      filename: 'error-%DATE%.log',
      datePattern: 'YYYY-MM-DD',
      zippedArchive: true,
      maxSize: '20m',
      maxFiles: '30d',
      level: 'error',
      format: winston.format.combine(
        winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
        winston.format.errors({ stack: true }),
        winston.format.splat(),
        winston.format.json(),
      ),
    }),
  ],
};
