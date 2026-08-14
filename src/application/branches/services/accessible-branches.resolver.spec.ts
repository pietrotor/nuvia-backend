import { UserBranchRepository } from '@domain/branches/repositories/user-branch.repository';
import { TenantContextPort } from '@domain/tenants/ports/tenant-context.port';
import { AccessibleBranchesResolver } from './accessible-branches.resolver';

describe('AccessibleBranchesResolver', () => {
  let tenantContext: jest.Mocked<Pick<TenantContextPort, 'userId'>>;
  let userBranches: jest.Mocked<
    Pick<UserBranchRepository, 'findBranchIdsByUser'>
  >;
  let resolver: AccessibleBranchesResolver;

  beforeEach(() => {
    tenantContext = { userId: 'user-1' };
    userBranches = {
      findBranchIdsByUser: jest.fn().mockResolvedValue([]),
    };
    resolver = new AccessibleBranchesResolver(
      tenantContext as unknown as TenantContextPort,
      userBranches as unknown as UserBranchRepository,
    );
  });

  it('returns null when the user has no branch rows (tenant-wide)', async () => {
    await expect(resolver.forCurrentUser()).resolves.toBeNull();
    expect(userBranches.findBranchIdsByUser).toHaveBeenCalledWith('user-1');
  });

  it('returns the branch ids when the user is restricted', async () => {
    userBranches.findBranchIdsByUser.mockResolvedValue(['b1', 'b2']);

    await expect(resolver.forCurrentUser()).resolves.toEqual(['b1', 'b2']);
  });

  it('returns null when there is no userId on the context', async () => {
    const withoutUser = new AccessibleBranchesResolver(
      { userId: null } as unknown as TenantContextPort,
      userBranches as unknown as UserBranchRepository,
    );

    await expect(withoutUser.forCurrentUser()).resolves.toBeNull();
    expect(userBranches.findBranchIdsByUser).not.toHaveBeenCalled();
  });
});
