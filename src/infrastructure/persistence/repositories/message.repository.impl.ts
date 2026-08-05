import { Injectable } from '@nestjs/common';
import { and, desc, eq } from 'drizzle-orm';

import { Message } from '@domain/conversations/entities/message.entity';
import {
  MessageRepository,
  RecordMessageData,
} from '@domain/conversations/repositories/message.repository';
import { TenantContextService } from '@infrastructure/tenancy/tenant-context.service';

import { DrizzleService } from '../drizzle/drizzle.service';
import { messages } from '../drizzle/schema/conversation.schema';
import { MessageMapper } from '../drizzle/mappers/conversation.mapper';
import { TenantScopedRepository } from './tenant-scoped.repository';

@Injectable()
export class DrizzleMessageRepository
  extends TenantScopedRepository
  implements MessageRepository
{
  constructor(drizzle: DrizzleService, tenantContext: TenantContextService) {
    super(drizzle, tenantContext);
  }

  async recordIfNew(data: RecordMessageData): Promise<Message | null> {
    const [row] = await this.drizzle.db
      .insert(messages)
      .values({ ...data, tenantId: this.tenantId })
      .onConflictDoNothing({
        target: [messages.tenantId, messages.providerMessageId],
      })
      .returning();
    return row ? MessageMapper.toDomain(row) : null;
  }

  async findRecent(conversationId: string, limit: number): Promise<Message[]> {
    const rows = await this.drizzle.db
      .select()
      .from(messages)
      .where(
        and(
          eq(messages.tenantId, this.tenantId),
          eq(messages.conversationId, conversationId),
        ),
      )
      .orderBy(desc(messages.occurredAt))
      .limit(limit);
    return rows.reverse().map(MessageMapper.toDomain);
  }

  async findByConversation(
    conversationId: string,
    input: { limit: number; offset: number },
  ): Promise<Message[]> {
    const rows = await this.drizzle.db
      .select()
      .from(messages)
      .where(
        and(
          eq(messages.tenantId, this.tenantId),
          eq(messages.conversationId, conversationId),
        ),
      )
      .orderBy(desc(messages.occurredAt))
      .limit(input.limit)
      .offset(input.offset);
    return rows.reverse().map(MessageMapper.toDomain);
  }

  async hasReplyTo(providerMessageId: string): Promise<boolean> {
    const [row] = await this.drizzle.db
      .select({ id: messages.id })
      .from(messages)
      .where(
        and(
          eq(messages.tenantId, this.tenantId),
          eq(messages.inReplyToProviderMessageId, providerMessageId),
        ),
      )
      .limit(1);
    return Boolean(row);
  }
}
