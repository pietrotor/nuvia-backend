import { Branch } from '@domain/branches/entities/branch.entity';
import {
  BranchNotFoundError,
  BranchRequiredError,
} from '@domain/branches/exceptions/branch.exceptions';
import { WeeklyHours } from '@domain/business-config/entities/business-config.entity';

import { BranchResolver } from './branch-resolver.service';

const HOURS: WeeklyHours = {
  mon: { start: '09:00', end: '18:00' },
  tue: { start: '09:00', end: '18:00' },
  wed: { start: '09:00', end: '18:00' },
  thu: { start: '09:00', end: '18:00' },
  fri: { start: '09:00', end: '18:00' },
  sat: null,
  sun: null,
};

const branch = (id: string, isActive = true): Branch =>
  new Branch({
    id,
    tenantId: 'tenant-1',
    name: id,
    slug: id,
    address: null,
    mapsUrl: null,
    phone: null,
    weeklyHours: HOURS,
    timezone: null,
    isPrimary: id === 'primary',
    isActive,
  });

describe('BranchResolver', () => {
  const repo = {
    findById: jest.fn(),
    findActive: jest.fn(),
  };
  const resolver = new BranchResolver(repo as never);

  beforeEach(() => {
    jest.resetAllMocks();
  });

  it('returns the given active branch', async () => {
    repo.findById.mockResolvedValue(branch('centro'));
    await expect(resolver.resolve('centro')).resolves.toMatchObject({
      id: 'centro',
    });
  });

  it('rejects an inactive or missing explicit branch', async () => {
    repo.findById.mockResolvedValue(null);
    await expect(resolver.resolve('missing')).rejects.toBeInstanceOf(
      BranchNotFoundError,
    );

    repo.findById.mockResolvedValue(branch('cerrada', false));
    await expect(resolver.resolve('cerrada')).rejects.toBeInstanceOf(
      BranchNotFoundError,
    );
  });

  it('picks the only active branch when none is requested', async () => {
    repo.findActive.mockResolvedValue([branch('primary')]);
    await expect(resolver.resolve()).resolves.toMatchObject({
      id: 'primary',
    });
  });

  it('requires an explicit branch when several are active', async () => {
    repo.findActive.mockResolvedValue([branch('primary'), branch('norte')]);
    await expect(resolver.resolve()).rejects.toBeInstanceOf(
      BranchRequiredError,
    );
  });

  it('fails when the tenant has no active branch', async () => {
    repo.findActive.mockResolvedValue([]);
    await expect(resolver.resolve()).rejects.toBeInstanceOf(
      BranchNotFoundError,
    );
  });
});
