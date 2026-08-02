import { Inject, Injectable } from '@nestjs/common';

import {
  USER_REPOSITORY,
  UserRepository,
} from '@domain/users/repositories/user.repository';
import { PublicUser } from '@domain/users/entities/user.entity';
import { Role } from '@domain/users/value-objects/role.vo';
import {
  CannotDemoteLastOwnerError,
  UserNotFoundError,
} from '@domain/users/exceptions/user.exceptions';
import { AuditAction } from '@domain/audit/entities/audit-log.entity';
import { AuditRecorder } from '@application/audit/services/audit-recorder.service';
import { UpdateUserRoleDto } from '../dto/update-user-role.dto';

@Injectable()
export class UpdateUserRoleUseCase {
  constructor(
    @Inject(USER_REPOSITORY)
    private readonly userRepository: UserRepository,
    private readonly audit: AuditRecorder,
  ) {}

  async execute(id: string, dto: UpdateUserRoleDto): Promise<PublicUser> {
    const user = await this.userRepository.findById(id);

    if (!user) {
      throw new UserNotFoundError(id);
    }

    if (user.isOwner() && dto.role !== Role.OWNER) {
      const owners = await this.userRepository.countActiveOwners();

      if (owners <= 1) {
        throw new CannotDemoteLastOwnerError();
      }
    }

    const updated = await this.userRepository.update(id, { role: dto.role });

    if (!updated) {
      throw new UserNotFoundError(id);
    }

    await this.audit.record({
      action: AuditAction.USER_ROLE_CHANGED,
      entity: 'user',
      entityId: id,
      before: { role: user.role },
      after: { role: updated.role },
    });

    return updated.toPublic();
  }
}
