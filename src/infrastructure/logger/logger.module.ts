import { Global, Module } from '@nestjs/common';
import { WinstonModule } from 'nest-winston';

import { LOGGER_PORT } from '@domain/common/ports/logger.port';

import { winstonConfig } from './winston.config';
import { AppLoggerService } from './logger.service';

@Global()
@Module({
  imports: [WinstonModule.forRoot(winstonConfig)],
  providers: [
    AppLoggerService,
    { provide: LOGGER_PORT, useExisting: AppLoggerService },
  ],
  exports: [WinstonModule, AppLoggerService, LOGGER_PORT],
})
export class LoggerModule {}
