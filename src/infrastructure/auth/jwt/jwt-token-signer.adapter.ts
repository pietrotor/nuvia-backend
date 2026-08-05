import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';

import {
  AuthTokenPayload,
  TokenSignerPort,
} from '@domain/auth/ports/token-signer.port';

@Injectable()
export class JwtTokenSignerAdapter implements TokenSignerPort {
  constructor(private readonly jwt: JwtService) {}

  sign(payload: AuthTokenPayload): string {
    return this.jwt.sign(payload);
  }
}
