import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import {
  TENANT_REPOSITORY,
  TenantRepository,
} from '@domain/tenants/repositories/tenant.repository';
import { Vertical } from '@domain/tenants/value-objects/vertical.vo';
import {
  USER_REPOSITORY,
  UserRepository,
} from '@domain/users/repositories/user.repository';
import { Role } from '@domain/users/value-objects/role.vo';
import { ErrorCode, ForbiddenError } from '@domain/common/exceptions';
import { BcryptService } from '@infrastructure/auth/bcrypt/bcrypt.service';
import { TenantContextService } from '@infrastructure/tenancy/tenant-context.service';

const SEED_PASSWORD = 'Secreta123';

const FIXTURES = [
  {
    name: 'Academia de Danza Ritmo',
    vertical: Vertical.ACADEMY,
    owner: { name: 'Ana Quiroga', email: 'ana@ritmo.test' },
    staff: { name: 'Luis Paz', email: 'luis@ritmo.test' },
  },
  {
    name: 'Guardería Pasitos',
    vertical: Vertical.DAYCARE,
    owner: { name: 'Marta Vargas', email: 'marta@pasitos.test' },
    staff: { name: 'Rocío Díaz', email: 'rocio@pasitos.test' },
  },
];

export interface SeedResult {
  tenants: { id: string; name: string; owner: string; staff: string }[];
  superadmin: string;
}

@Injectable()
export class SeedUseCase {
  constructor(
    @Inject(TENANT_REPOSITORY)
    private readonly tenantRepository: TenantRepository,
    @Inject(USER_REPOSITORY)
    private readonly userRepository: UserRepository,
    private readonly bcrypt: BcryptService,
    private readonly tenantContext: TenantContextService,
    private readonly config: ConfigService,
  ) {}

  async execute(): Promise<SeedResult> {
    if (this.config.get('NODE_ENV') === 'production') {
      throw new ForbiddenError(ErrorCode.SEED_DISABLED);
    }

    await this.userRepository.deleteAllUnscoped();
    await this.tenantRepository.deleteAll();

    const password = await this.bcrypt.hash(SEED_PASSWORD);

    const superadmin = await this.userRepository.createSuperadminUnscoped({
      name: 'Soporte CobrAI',
      email: 'soporte@cobrai.test',
      password,
    });

    const tenants: SeedResult['tenants'] = [];

    for (const fixture of FIXTURES) {
      const tenant = await this.tenantRepository.create({
        name: fixture.name,
        vertical: fixture.vertical,
      });

      await this.tenantContext.runWithTenant(tenant.id, async () => {
        await this.userRepository.create({
          ...fixture.owner,
          password,
          role: Role.OWNER,
        });
        await this.userRepository.create({
          ...fixture.staff,
          password,
          role: Role.STAFF,
        });
      });

      tenants.push({
        id: tenant.id,
        name: tenant.name,
        owner: fixture.owner.email,
        staff: fixture.staff.email,
      });
    }

    return { tenants, superadmin: superadmin.email };
  }
}
