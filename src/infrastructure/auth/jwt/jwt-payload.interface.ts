import { Role } from '@domain/users/value-objects/role.vo';

export interface JwtPayload {
  sub: string;
  tenantId: string | null;
  role: Role;
}
