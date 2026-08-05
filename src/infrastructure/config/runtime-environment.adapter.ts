import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { RuntimeEnvironmentPort } from '@domain/common/ports/runtime-environment.port';

@Injectable()
export class RuntimeEnvironmentAdapter implements RuntimeEnvironmentPort {
  constructor(private readonly config: ConfigService) {}

  isProduction(): boolean {
    return this.config.get('NODE_ENV') === 'production';
  }
}
