import { Professional } from '@domain/professionals/entities/professional.entity';
import { ProfessionalSchema } from '../schema/professional.schema';

export class ProfessionalMapper {
  static toDomain(row: ProfessionalSchema): Professional {
    return new Professional({
      id: row.id,
      tenantId: row.tenantId,
      name: row.name,
      weeklyHours: row.weeklyHours,
      isActive: row.isActive,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    });
  }
}
