import { Client } from '@domain/clients/entities/client.entity';
import { ClientSchema } from '../schema/client.schema';

export class ClientMapper {
  static toDomain(row: ClientSchema): Client {
    return new Client({
      id: row.id,
      tenantId: row.tenantId,
      name: row.name,
      phoneE164: row.phoneE164,
      notes: row.notes,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    });
  }
}
