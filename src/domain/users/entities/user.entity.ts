import { Role } from '../value-objects/role.vo';

export interface UserProps {
  id: string;
  tenantId: string | null;
  professionalId?: string | null;
  name: string;
  email: string;
  password: string;
  role: Role;
  isActive: boolean;
  phone?: string | null;
  createdAt?: Date;
  updatedAt?: Date;
}

export type PublicUser = Omit<UserProps, 'password'>;

export class User {
  public readonly id: string;
  public readonly tenantId: string | null;
  public readonly professionalId: string | null;
  public readonly name: string;
  public readonly email: string;
  public readonly password: string;
  public readonly role: Role;
  public readonly isActive: boolean;
  public readonly phone: string | null;
  public readonly createdAt?: Date;
  public readonly updatedAt?: Date;

  constructor(props: UserProps) {
    this.id = props.id;
    this.tenantId = props.tenantId;
    this.professionalId = props.professionalId ?? null;
    this.name = props.name;
    this.email = props.email;
    this.password = props.password;
    this.role = props.role;
    this.isActive = props.isActive;
    this.phone = props.phone ?? null;
    this.createdAt = props.createdAt;
    this.updatedAt = props.updatedAt;
  }

  isSuperadmin(): boolean {
    return this.role === Role.SUPERADMIN;
  }

  isOwner(): boolean {
    return this.role === Role.OWNER;
  }

  isStaff(): boolean {
    return this.role === Role.STAFF;
  }

  belongsToTenant(tenantId: string): boolean {
    return this.tenantId !== null && this.tenantId === tenantId;
  }

  canAdminister(): boolean {
    return this.isOwner() || this.isSuperadmin();
  }

  toPublic(): PublicUser {
    return {
      id: this.id,
      tenantId: this.tenantId,
      professionalId: this.professionalId,
      name: this.name,
      email: this.email,
      role: this.role,
      isActive: this.isActive,
      phone: this.phone,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };
  }
}
