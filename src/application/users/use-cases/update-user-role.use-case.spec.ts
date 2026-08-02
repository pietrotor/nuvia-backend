import { User } from '@domain/users/entities/user.entity';
import { Role } from '@domain/users/value-objects/role.vo';
import { UserRepository } from '@domain/users/repositories/user.repository';
import {
  CannotDemoteLastOwnerError,
  UserNotFoundError,
} from '@domain/users/exceptions/user.exceptions';
import { AuditAction } from '@domain/audit/entities/audit-log.entity';
import { AuditRecorder } from '@application/audit/services/audit-recorder.service';
import { UpdateUserRoleUseCase } from './update-user-role.use-case';

const user = (role: Role) =>
  new User({
    id: 'user-1',
    tenantId: 'tenant-1',
    name: 'Ana',
    email: 'ana@ritmo.test',
    password: 'hash',
    role,
    isActive: true,
  });

describe('UpdateUserRoleUseCase', () => {
  let userRepository: jest.Mocked<
    Pick<UserRepository, 'findById' | 'countActiveOwners' | 'update'>
  >;
  let audit: jest.Mocked<Pick<AuditRecorder, 'record'>>;
  let useCase: UpdateUserRoleUseCase;

  beforeEach(() => {
    userRepository = {
      findById: jest.fn(),
      countActiveOwners: jest.fn(),
      update: jest.fn(),
    };
    audit = { record: jest.fn().mockResolvedValue(undefined) };

    useCase = new UpdateUserRoleUseCase(
      userRepository as unknown as UserRepository,
      audit as unknown as AuditRecorder,
    );
  });

  it('refuses to demote the last owner of the tenant', async () => {
    userRepository.findById.mockResolvedValue(user(Role.OWNER));
    userRepository.countActiveOwners.mockResolvedValue(1);

    await expect(
      useCase.execute('user-1', { role: Role.STAFF }),
    ).rejects.toThrow(CannotDemoteLastOwnerError);
    expect(userRepository.update).not.toHaveBeenCalled();
  });

  it('allows the demotion when another owner remains', async () => {
    userRepository.findById.mockResolvedValue(user(Role.OWNER));
    userRepository.countActiveOwners.mockResolvedValue(2);
    userRepository.update.mockResolvedValue(user(Role.STAFF));

    const result = await useCase.execute('user-1', { role: Role.STAFF });

    expect(result.role).toBe(Role.STAFF);
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: AuditAction.USER_ROLE_CHANGED,
        before: { role: Role.OWNER },
        after: { role: Role.STAFF },
      }),
    );
  });

  it('treats a user of another tenant as non-existent', async () => {
    userRepository.findById.mockResolvedValue(null);

    await expect(
      useCase.execute('user-of-another-tenant', { role: Role.STAFF }),
    ).rejects.toThrow(UserNotFoundError);
  });
});
