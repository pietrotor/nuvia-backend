import { User } from '../entities/user.entity';
import { Role } from '../value-objects/role.vo';

export interface CreateUserData {
  name: string;
  email: string;
  password: string;
  role: Role;
  phone?: string | null;
  isActive?: boolean;
}

export interface UpdateUserData {
  name?: string;
  phone?: string | null;
  password?: string;
  role?: Role;
  isActive?: boolean;
}

export interface UserRepository {
  // Unscoped operations. Login and token validation run before there is a tenant
  // in context, and superadmins have no tenant at all. Do not use them elsewhere.
  findByEmailUnscoped(email: string): Promise<User | null>;
  findByIdUnscoped(id: string): Promise<User | null>;
  createSuperadminUnscoped(data: Omit<CreateUserData, 'role'>): Promise<User>;

  // Scoped to the tenant in context: create() takes the tenant from the request,
  // never from its arguments.
  create(data: CreateUserData): Promise<User>;
  findById(id: string): Promise<User | null>;
  findAllOfTenant(): Promise<User[]>;
  countActiveOwners(): Promise<number>;
  update(id: string, data: UpdateUserData): Promise<User | null>;
  delete(id: string): Promise<void>;
  deleteAllUnscoped(): Promise<void>;
}

export const USER_REPOSITORY = 'UserRepository';
