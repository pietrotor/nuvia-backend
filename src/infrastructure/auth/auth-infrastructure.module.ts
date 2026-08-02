import { Global, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';

import { BcryptService } from './bcrypt/bcrypt.service';
import { JwtStrategy } from './jwt/jwt.strategy';

@Global()
@Module({
  imports: [
    ConfigModule,
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>('JWT_SECRET'),
        signOptions: {
          expiresIn: config.get<string>('JWT_EXPIRES_IN') ?? '12h',
        },
      }),
    }),
  ],
  providers: [BcryptService, JwtStrategy],
  exports: [BcryptService, JwtStrategy, JwtModule, PassportModule],
})
export class AuthInfrastructureModule {}
