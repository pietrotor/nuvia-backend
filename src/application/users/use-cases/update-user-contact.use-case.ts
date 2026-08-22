import { Inject, Injectable } from '@nestjs/common';

import { PhoneNumberService } from '@application/common/services/phone-number.service';
import { TenantCountryService } from '@application/common/services/tenant-country.service';
import { AuditAction } from '@domain/audit/entities/audit-log.entity';
import { AuditRecorder } from '@application/audit/services/audit-recorder.service';
import { PublicUser } from '@domain/users/entities/user.entity';
import { UserNotFoundError } from '@domain/users/exceptions/user.exceptions';
import {
  USER_REPOSITORY,
  UserRepository,
} from '@domain/users/repositories/user.repository';

import { UpdateUserContactDto } from '../dto/update-user-contact.dto';

@Injectable()
export class UpdateUserContactUseCase {
  constructor(
    @Inject(USER_REPOSITORY)
    private readonly userRepository: UserRepository,
    private readonly audit: AuditRecorder,
    private readonly phoneNumbers: PhoneNumberService,
    private readonly tenantCountry: TenantCountryService,
  ) {}

  async execute(id: string, dto: UpdateUserContactDto): Promise<PublicUser> {
    const user = await this.userRepository.findById(id);
    if (!user) throw new UserNotFoundError(id);

    const country = await this.tenantCountry.getCurrentCountryCode();
    const phone =
      dto.phone === undefined
        ? undefined
        : this.phoneNumbers.resolvePhoneForWrite(
            dto.phone,
            user.phone,
            country,
          );

    const updated = await this.userRepository.update(id, { phone });
    if (!updated) throw new UserNotFoundError(id);

    await this.audit.record({
      action: AuditAction.USER_UPDATED,
      entity: 'user',
      entityId: id,
      before: { phone: user.phone },
      after: { phone: updated.phone },
    });

    return updated.toPublic();
  }
}
