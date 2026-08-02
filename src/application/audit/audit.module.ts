import { Global, Module } from '@nestjs/common';

import { AuditRecorder } from './services/audit-recorder.service';

@Global()
@Module({
  providers: [AuditRecorder],
  exports: [AuditRecorder],
})
export class AuditModule {}
