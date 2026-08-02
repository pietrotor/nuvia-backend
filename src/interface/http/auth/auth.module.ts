import { Module } from '@nestjs/common';

import { LoginUseCase } from '@application/auth/use-cases/login.use-case';
import { AuthController } from './auth.controller';

@Module({
  controllers: [AuthController],
  providers: [LoginUseCase],
})
export class AuthModule {}
