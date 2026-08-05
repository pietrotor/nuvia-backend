import { Injectable } from '@nestjs/common';
import { and, desc, eq } from 'drizzle-orm';

import {
  ConversationView,
  ConversationViewRepository,
} from '@domain/conversations/repositories/conversation-view.repository';
import { TenantContextService } from '@infrastructure/tenancy/tenant-context.service';

import { DrizzleService } from '../drizzle/drizzle.service';
import { clients } from '../drizzle/schema/client.schema';
import { conversations } from '../drizzle/schema/conversation.schema';
import { ConversationMapper } from '../drizzle/mappers/conversation.mapper';
import { TenantScopedRepository } from './tenant-scoped.repository';

@Injectable()
export class DrizzleConversationViewRepository
  extends TenantScopedRepository
  implements ConversationViewRepository
{
  constructor(drizzle: DrizzleService, tenantContext: TenantContextService) {
    super(drizzle, tenantContext);
  }

  // Left join because a conversation can arrive before the client is registered; the
  // name is resolved in the same query as the inbox.
  async list(input: {
    limit: number;
    offset: number;
  }): Promise<ConversationView[]> {
    const rows = await this.drizzle.db
      .select({
        conversation: conversations,
        client: {
          id: clients.id,
          name: clients.name,
          phoneE164: clients.phoneE164,
        },
      })
      .from(conversations)
      .leftJoin(
        clients,
        and(
          eq(clients.id, conversations.clientId),
          eq(clients.tenantId, conversations.tenantId),
        ),
      )
      .where(this.scope(conversations))
      .orderBy(desc(conversations.lastActivityAt))
      .limit(input.limit)
      .offset(input.offset);

    return rows.map((row) => ({
      conversation: ConversationMapper.toDomain(row.conversation),
      client: row.client?.id ? row.client : null,
    }));
  }
}
