import { User } from '@domain/users/entities/user.entity';
import { Role } from '@domain/users/value-objects/role.vo';
import {
  InvalidCredentialsError,
  UserInactiveError,
} from '@domain/users/exceptions/user.exceptions';
import { UserRepository } from '@domain/users/repositories/user.repository';
import { Tenant } from '@domain/tenants/entities/tenant.entity';
import { TenantRepository } from '@domain/tenants/repositories/tenant.repository';
import { TenantStatus } from '@domain/tenants/value-objects/tenant-status.vo';
import { TenantSuspendedError } from '@domain/tenants/exceptions/tenant.exceptions';
import { AuditAction } from '@domain/audit/entities/audit-log.entity';
import { PasswordHasherPort } from '@domain/users/ports/password-hasher.port';
import { TokenSignerPort } from '@domain/auth/ports/token-signer.port';
import { AuditRecorder } from '@application/audit/services/audit-recorder.service';
import { LoginUseCase } from './login.use-case';

const tenant = (status: TenantStatus) =>
  new Tenant({
    id: 'tenant-1',
    name: 'Estética Glow',
    status,
    timezone: 'America/La_Paz',
  });

const user = (overrides: Partial<ConstructorParameters<typeof User>[0]> = {}) =>
  new User({
    id: 'user-1',
    tenantId: 'tenant-1',
    name: 'Ana',
    email: 'ana@ritmo.test',
    password: 'hash',
    role: Role.OWNER,
    isActive: true,
    ...overrides,
  });

describe('LoginUseCase', () => {
  const credentials = { email: 'Ana@Ritmo.test ', password: 'Secreta123' };

  let userRepository: jest.Mocked<Pick<UserRepository, 'findByEmailUnscoped'>>;
  let tenantRepository: jest.Mocked<Pick<TenantRepository, 'findById'>>;
  let passwordHasher: jest.Mocked<Pick<PasswordHasherPort, 'compare'>>;
  let audit: jest.Mocked<Pick<AuditRecorder, 'record'>>;
  let useCase: LoginUseCase;

  beforeEach(() => {
    userRepository = { findByEmailUnscoped: jest.fn() };
    tenantRepository = { findById: jest.fn() };
    passwordHasher = { compare: jest.fn().mockResolvedValue(true) };
    audit = { record: jest.fn().mockResolvedValue(undefined) };

    useCase = new LoginUseCase(
      userRepository as unknown as UserRepository,
      tenantRepository as unknown as TenantRepository,
      passwordHasher as unknown as PasswordHasherPort,
      { sign: () => 'signed-token' } as TokenSignerPort,
      audit as unknown as AuditRecorder,
    );
  });

  it('issues a token carrying tenant and role, and never the password', async () => {
    userRepository.findByEmailUnscoped.mockResolvedValue(user());
    tenantRepository.findById.mockResolvedValue(tenant(TenantStatus.ACTIVE));

    const result = await useCase.execute(credentials);

    expect(userRepository.findByEmailUnscoped).toHaveBeenCalledWith(
      'ana@ritmo.test',
    );
    expect(result.token).toBe('signed-token');
    expect(result.user).not.toHaveProperty('password');
    expect(result.user.tenantId).toBe('tenant-1');
  });

  it('logs the failure without revealing whether the email exists', async () => {
    userRepository.findByEmailUnscoped.mockResolvedValue(user());
    passwordHasher.compare.mockResolvedValue(false);

    await expect(useCase.execute(credentials)).rejects.toThrow(
      InvalidCredentialsError,
    );
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({ action: AuditAction.LOGIN_FAILED }),
    );
  });

  it('rejects an unknown email with the same error', async () => {
    userRepository.findByEmailUnscoped.mockResolvedValue(null);

    await expect(useCase.execute(credentials)).rejects.toThrow(
      InvalidCredentialsError,
    );
  });

  it('rejects a deactivated user', async () => {
    userRepository.findByEmailUnscoped.mockResolvedValue(
      user({ isActive: false }),
    );

    await expect(useCase.execute(credentials)).rejects.toThrow(
      UserInactiveError,
    );
  });

  it('rejects a user whose tenant is suspended', async () => {
    userRepository.findByEmailUnscoped.mockResolvedValue(user());
    tenantRepository.findById.mockResolvedValue(tenant(TenantStatus.SUSPENDED));

    await expect(useCase.execute(credentials)).rejects.toThrow(
      TenantSuspendedError,
    );
  });

  it('lets a superadmin in without a tenant', async () => {
    userRepository.findByEmailUnscoped.mockResolvedValue(
      user({ tenantId: null, role: Role.SUPERADMIN }),
    );

    const result = await useCase.execute(credentials);

    expect(tenantRepository.findById).not.toHaveBeenCalled();
    expect(result.user.tenantId).toBeNull();
  });
});
