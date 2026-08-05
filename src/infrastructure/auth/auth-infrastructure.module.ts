import { Global, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';

import { PASSWORD_HASHER_PORT } from '@domain/users/ports/password-hasher.port';
import { TOKEN_SIGNER_PORT } from '@domain/auth/ports/token-signer.port';

import { BcryptService } from './bcrypt/bcrypt.service';
import { JwtStrategy } from './jwt/jwt.strategy';
import { JwtTokenSignerAdapter } from './jwt/jwt-token-signer.adapter';

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
  providers: [
    BcryptService,
    JwtTokenSignerAdapter,
    { provide: PASSWORD_HASHER_PORT, useExisting: BcryptService },
    { provide: TOKEN_SIGNER_PORT, useExisting: JwtTokenSignerAdapter },
    JwtStrategy,
  ],
  exports: [
    PASSWORD_HASHER_PORT,
    TOKEN_SIGNER_PORT,
    JwtStrategy,
    JwtModule,
    PassportModule,
  ],
})
export class AuthInfrastructureModule {}
