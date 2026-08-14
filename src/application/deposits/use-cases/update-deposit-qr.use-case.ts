import { Inject, Injectable } from '@nestjs/common';

import { AuditRecorder } from '@application/audit/services/audit-recorder.service';
import { AuditAction } from '@domain/audit/entities/audit-log.entity';
import { DepositQr } from '@domain/deposits/entities/deposit-qr.entity';
import { DepositQrNotFoundError } from '@domain/deposits/exceptions/deposit-qr.exceptions';
import {
  DEPOSIT_QR_REPOSITORY,
  DepositQrRepository,
} from '@domain/deposits/repositories/deposit-qr.repository';
import { UpdateDepositQrDto } from '../dto/update-deposit-qr.dto';

@Injectable()
export class UpdateDepositQrUseCase {
  constructor(
    @Inject(DEPOSIT_QR_REPOSITORY)
    private readonly depositQrRepository: DepositQrRepository,
    private readonly audit: AuditRecorder,
  ) {}

  async execute(id: string, dto: UpdateDepositQrDto): Promise<DepositQr> {
    const current = await this.depositQrRepository.findById(id);
    if (!current) throw new DepositQrNotFoundError(id);

    const updated = await this.apply(current, dto);

    await this.audit.record({
      action: AuditAction.DEPOSIT_QR_UPDATED,
      entity: 'deposit_qr',
      entityId: id,
      before: {
        label: current.label,
        isDefault: current.isDefault,
        isActive: current.isActive,
      },
      after: {
        label: updated.label,
        isDefault: updated.isDefault,
        isActive: updated.isActive,
      },
    });

    return updated;
  }

  private async apply(
    current: DepositQr,
    dto: UpdateDepositQrDto,
  ): Promise<DepositQr> {
    const renamed =
      dto.label !== undefined ? current.rename(dto.label.trim()) : current;

    // Archiving wins over promoting: a retired account cannot be the one the agent
    // charges with.
    if (dto.isActive === false) {
      return this.depositQrRepository.save(renamed.archive());
    }

    const saved = await this.depositQrRepository.save(
      dto.isActive === true ? renamed.restore() : renamed,
    );
    if (dto.isDefault !== true) return saved;

    // Promoting moves the default off whichever QR held it, so the repository writes
    // both rows in one transaction.
    const promoted = await this.depositQrRepository.promoteToDefault(saved.id);
    if (!promoted) throw new DepositQrNotFoundError(current.id);

    return promoted;
  }
}
