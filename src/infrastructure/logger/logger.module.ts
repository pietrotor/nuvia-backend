import { Global, Module } from '@nestjs/common';
import { WinstonModule } from 'nest-winston';

import { winstonConfig } from './winston.config';
import { AppLoggerService } from './logger.service';

@Global()
@Module({
  imports: [WinstonModule.forRoot(winstonConfig)],
  providers: [AppLoggerService],
  exports: [WinstonModule, AppLoggerService],
})
export class LoggerModule {}
