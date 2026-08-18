import { Injectable } from '@nestjs/common';
import { eq, isNull } from 'drizzle-orm';

import { ConversationRepository } from '@domain/conversations/repositories/conversation.repository';
import { Conversation } from '@domain/conversations/entities/conversation.entity';
import { TenantContextService } from '@infrastructure/tenancy/tenant-context.service';

import { DrizzleService } from '../drizzle/drizzle.service';
import { conversations } from '../drizzle/schema/conversation.schema';
import { ConversationMapper } from '../drizzle/mappers/conversation.mapper';
import { TenantScopedRepository } from './tenant-scoped.repository';

@Injectable()
export class DrizzleConversationRepository
  extends TenantScopedRepository
  implements ConversationRepository
{
  constructor(drizzle: DrizzleService, tenantContext: TenantContextService) {
    super(drizzle, tenantContext);
  }

  async findOrCreate(input: {
    clientPhoneE164: string;
    clientId: string;
    occurredAt: Date;
  }): Promise<Conversation> {
    const [row] = await this.drizzle.db
      .insert(conversations)
      .values({
        tenantId: this.tenantId,
        clientId: input.clientId,
        clientPhoneE164: input.clientPhoneE164,
        lastActivityAt: input.occurredAt,
      })
      .onConflictDoUpdate({
        target: [conversations.tenantId, conversations.clientPhoneE164],
        set: {
          clientId: input.clientId,
          lastActivityAt: input.occurredAt,
          updatedAt: new Date(),
        },
      })
      .returning();

    return ConversationMapper.toDomain(row);
  }

  async findById(id: string): Promise<Conversation | null> {
    const [row] = await this.selectFrom(
      conversations,
      eq(conversations.id, id),
    );
    return row ? ConversationMapper.toDomain(row) : null;
  }

  async findByClientPhone(
    clientPhoneE164: string,
  ): Promise<Conversation | null> {
    const [row] = await this.selectFrom(
      conversations,
      eq(conversations.clientPhoneE164, clientPhoneE164),
    );
    return row ? ConversationMapper.toDomain(row) : null;
  }

  async setHandoff(id: string, reason: string): Promise<Conversation | null> {
    const [row] = await this.updateIn(
      conversations,
      {
        botPaused: true,
        botPausedAt: new Date(),
        handoffReason: reason,
      },
      eq(conversations.id, id),
    );
    return row ? ConversationMapper.toDomain(row) : null;
  }

  async pauseBot(id: string): Promise<Conversation | null> {
    const [row] = await this.updateIn(
      conversations,
      { botPaused: true, botPausedAt: new Date() },
      eq(conversations.id, id),
    );
    return row ? ConversationMapper.toDomain(row) : null;
  }

  // When someone from the business replies, the agent goes quiet in that conversation
  // (two voices confuse the client) and the conversation moves up in the inbox. Both
  // things in a single update: one never ends up done without the other.
  async recordManualReply(
    id: string,
    occurredAt: Date,
  ): Promise<Conversation | null> {
    const [row] = await this.updateIn(
      conversations,
      {
        botPaused: true,
        botPausedAt: occurredAt,
        lastActivityAt: occurredAt,
      },
      eq(conversations.id, id),
    );
    return row ? ConversationMapper.toDomain(row) : null;
  }

  // Resuming the bot closes the handoff: the owner already dealt with the reason.
  async resumeBot(id: string): Promise<Conversation | null> {
    const [row] = await this.updateIn(
      conversations,
      { botPaused: false, botPausedAt: null, handoffReason: null },
      eq(conversations.id, id),
    );
    return row ? ConversationMapper.toDomain(row) : null;
  }

  async setBranch(id: string, branchId: string): Promise<Conversation | null> {
    const [row] = await this.updateIn(
      conversations,
      { branchId },
      eq(conversations.id, id),
    );
    return row ? ConversationMapper.toDomain(row) : null;
  }

  async assignBranchToAllWithoutBranch(branchId: string): Promise<number> {
    const updated = await this.updateIn(
      conversations,
      { branchId },
      isNull(conversations.branchId),
    );
    return updated.length;
  }

  async deleteAllUnscoped(): Promise<void> {
    await this.drizzle.db.delete(conversations);
  }
}
