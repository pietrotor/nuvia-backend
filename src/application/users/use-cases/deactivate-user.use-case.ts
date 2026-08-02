import { Inject, Injectable } from '@nestjs/common';

import {
  USER_REPOSITORY,
  UserRepository,
} from '@domain/users/repositories/user.repository';
import { PublicUser } from '@domain/users/entities/user.entity';
import {
  CannotDemoteLastOwnerError,
  UserNotFoundError,
} from '@domain/users/exceptions/user.exceptions';
import { AuditAction } from '@domain/audit/entities/audit-log.entity';
import { AuditRecorder } from '@application/audit/services/audit-recorder.service';

@Injectable()
export class DeactivateUserUseCase {
  constructor(
    @Inject(USER_REPOSITORY)
    private readonly userRepository: UserRepository,
    private readonly audit: AuditRecorder,
  ) {}

  async execute(id: string): Promise<PublicUser> {
    const user = await this.userRepository.findById(id);

    if (!user) {
      throw new UserNotFoundError(id);
    }

    if (
      user.isOwner() &&
      (await this.userRepository.countActiveOwners()) <= 1
    ) {
      throw new CannotDemoteLastOwnerError();
    }

    const updated = await this.userRepository.update(id, { isActive: false });

    if (!updated) {
      throw new UserNotFoundError(id);
    }

    await this.audit.record({
      action: AuditAction.USER_DEACTIVATED,
      entity: 'user',
      entityId: id,
      before: { isActive: true },
      after: { isActive: false },
    });

    return updated.toPublic();
  }
}
