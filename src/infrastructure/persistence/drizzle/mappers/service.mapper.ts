import { Currency } from '@domain/common/value-objects/currency.vo';
import { Service } from '@domain/services/entities/service.entity';
import { ServiceSchema } from '../schema/service.schema';

export class ServiceMapper {
  static toDomain(row: ServiceSchema, professionalIds: string[]): Service {
    return new Service({
      id: row.id,
      tenantId: row.tenantId,
      name: row.name,
      durationMinutes: row.durationMinutes,
      currency: row.currency as Currency,
      price: row.price,
      requiresDeposit: row.requiresDeposit,
      depositAmount: row.depositAmount,
      depositPercent: row.depositPercent,
      depositQrId: row.depositQrId,
      clientChoosesProfessional: row.clientChoosesProfessional,
      isActive: row.isActive,
      professionalIds,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    });
  }
}
