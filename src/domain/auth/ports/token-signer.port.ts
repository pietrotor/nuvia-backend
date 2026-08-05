import { Role } from '@domain/users/value-objects/role.vo';

export interface AuthTokenPayload {
  sub: string;
  tenantId: string | null;
  role: Role;
}

export interface TokenSignerPort {
  sign(payload: AuthTokenPayload): string;
}

export const TOKEN_SIGNER_PORT = 'TokenSignerPort';
