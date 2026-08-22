import { Injectable } from '@nestjs/common';
import { and, desc, eq, gt, lte, ne } from 'drizzle-orm';

import {
  DepositReceipt,
  DepositReceiptStatus,
} from '@domain/deposits/entities/deposit-receipt.entity';
import {
  CreateDepositReceiptData,
  DepositReceiptRepository,
} from '@domain/deposits/repositories/deposit-receipt.repository';
import { TenantContextService } from '@infrastructure/tenancy/tenant-context.service';
import { DrizzleService } from '../drizzle/drizzle.service';
import { DepositReceiptMapper } from '../drizzle/mappers/deposit-receipt.mapper';
import {
  depositReceiptExpectations,
  depositReceipts,
} from '../drizzle/schema/deposit-receipt.schema';
import { TenantScopedRepository } from './tenant-scoped.repository';

@Injectable()
export class DrizzleDepositReceiptRepository
  extends TenantScopedRepository
  implements DepositReceiptRepository
{
  constructor(drizzle: DrizzleService, tenantContext: TenantContextService) {
    super(drizzle, tenantContext);
  }

  async create(data: CreateDepositReceiptData): Promise<DepositReceipt> {
    const [row] = await this.insertInto(depositReceipts, {
      ...data,
      status: DepositReceiptStatus.PENDING_ASSIGNMENT,
    });
    return DepositReceiptMapper.toDomain(row);
  }

  async findById(id: string): Promise<DepositReceipt | null> {
    const [row] = await this.selectFrom(
      depositReceipts,
      eq(depositReceipts.id, id),
    );
    return row ? DepositReceiptMapper.toDomain(row) : null;
  }

  async findByIdForUpdate(id: string): Promise<DepositReceipt | null> {
    const [row] = await this.drizzle.db
      .select()
      .from(depositReceipts)
      .where(this.scope(depositReceipts, eq(depositReceipts.id, id)))
      .for('update')
      .limit(1);
    return row ? DepositReceiptMapper.toDomain(row) : null;
  }

  async findByProviderMessageId(
    providerMessageId: string,
  ): Promise<DepositReceipt | null> {
    const [row] = await this.selectFrom(
      depositReceipts,
      eq(depositReceipts.providerMessageId, providerMessageId),
    );
    return row ? DepositReceiptMapper.toDomain(row) : null;
  }

  async findActiveByAppointment(
    appointmentId: string,
  ): Promise<DepositReceipt | null> {
    const [row] = await this.selectFrom(
      depositReceipts,
      and(
        eq(depositReceipts.appointmentId, appointmentId),
        eq(depositReceipts.status, DepositReceiptStatus.ASSIGNED),
      ),
    );
    return row ? DepositReceiptMapper.toDomain(row) : null;
  }

  async findLatestForConversation(
    conversationId: string,
  ): Promise<DepositReceipt | null> {
    const [row] = await this.drizzle.db
      .select()
      .from(depositReceipts)
      .where(
        this.scope(
          depositReceipts,
          eq(depositReceipts.conversationId, conversationId),
        ),
      )
      .orderBy(desc(depositReceipts.receivedAt))
      .limit(1);
    return row ? DepositReceiptMapper.toDomain(row) : null;
  }

  async findLatestPendingForConversation(
    conversationId: string,
  ): Promise<DepositReceipt | null> {
    const [row] = await this.drizzle.db
      .select()
      .from(depositReceipts)
      .where(
        this.scope(
          depositReceipts,
          eq(depositReceipts.conversationId, conversationId),
          eq(depositReceipts.status, DepositReceiptStatus.PENDING_ASSIGNMENT),
        ),
      )
      .orderBy(desc(depositReceipts.receivedAt))
      .limit(1);
    return row ? DepositReceiptMapper.toDomain(row) : null;
  }

  async assign(input: {
    receiptId: string;
    appointmentId: string;
    supersededAt: Date;
  }): Promise<DepositReceipt | null> {
    return this.drizzle.runInTransaction(async () => {
      const receipt = await this.findById(input.receiptId);
      if (!receipt) return null;
      if (
        receipt.status === DepositReceiptStatus.ASSIGNED &&
        receipt.appointmentId === input.appointmentId
      ) {
        return receipt;
      }

      await this.drizzle.db
        .update(depositReceipts)
        .set({
          status: DepositReceiptStatus.SUPERSEDED,
          supersededAt: input.supersededAt,
        })
        .where(
          this.scope(
            depositReceipts,
            eq(depositReceipts.appointmentId, input.appointmentId),
            eq(depositReceipts.status, DepositReceiptStatus.ASSIGNED),
            ne(depositReceipts.id, input.receiptId),
          ),
        );

      const [assigned] = await this.drizzle.db
        .update(depositReceipts)
        .set({
          appointmentId: input.appointmentId,
          status: DepositReceiptStatus.ASSIGNED,
          supersededAt: null,
        })
        .where(
          this.scope(depositReceipts, eq(depositReceipts.id, input.receiptId)),
        )
        .returning();
      return assigned ? DepositReceiptMapper.toDomain(assigned) : null;
    });
  }

  async expectNext(input: {
    conversationId: string;
    clientId: string;
    appointmentId: string;
    expiresAt: Date;
    now: Date;
  }): Promise<void> {
    await this.drizzle.runInTransaction(async () => {
      await this.drizzle.db
        .update(depositReceiptExpectations)
        .set({ status: 'expired', resolvedAt: input.now })
        .where(
          this.scope(
            depositReceiptExpectations,
            eq(depositReceiptExpectations.conversationId, input.conversationId),
            eq(depositReceiptExpectations.status, 'active'),
          ),
        );
      await this.insertInto(depositReceiptExpectations, {
        conversationId: input.conversationId,
        clientId: input.clientId,
        appointmentId: input.appointmentId,
        status: 'active',
        expiresAt: input.expiresAt,
      });
    });
  }

  async consumeExpectation(input: {
    conversationId: string;
    now: Date;
  }): Promise<string | null> {
    return this.drizzle.runInTransaction(async () => {
      await this.drizzle.db
        .update(depositReceiptExpectations)
        .set({ status: 'expired', resolvedAt: input.now })
        .where(
          this.scope(
            depositReceiptExpectations,
            eq(depositReceiptExpectations.conversationId, input.conversationId),
            eq(depositReceiptExpectations.status, 'active'),
            lte(depositReceiptExpectations.expiresAt, input.now),
          ),
        );

      const [active] = await this.drizzle.db
        .select()
        .from(depositReceiptExpectations)
        .where(
          this.scope(
            depositReceiptExpectations,
            eq(depositReceiptExpectations.conversationId, input.conversationId),
            eq(depositReceiptExpectations.status, 'active'),
            gt(depositReceiptExpectations.expiresAt, input.now),
          ),
        )
        .orderBy(desc(depositReceiptExpectations.createdAt))
        .limit(1);
      if (!active) return null;

      await this.drizzle.db
        .update(depositReceiptExpectations)
        .set({ status: 'consumed', resolvedAt: input.now })
        .where(
          this.scope(
            depositReceiptExpectations,
            eq(depositReceiptExpectations.id, active.id),
            eq(depositReceiptExpectations.status, 'active'),
          ),
        );
      return active.appointmentId;
    });
  }

  async findExpectedAppointment(input: {
    conversationId: string;
    now: Date;
  }): Promise<string | null> {
    const [active] = await this.drizzle.db
      .select({ appointmentId: depositReceiptExpectations.appointmentId })
      .from(depositReceiptExpectations)
      .where(
        this.scope(
          depositReceiptExpectations,
          eq(depositReceiptExpectations.conversationId, input.conversationId),
          eq(depositReceiptExpectations.status, 'active'),
          gt(depositReceiptExpectations.expiresAt, input.now),
        ),
      )
      .orderBy(desc(depositReceiptExpectations.createdAt))
      .limit(1);
    return active?.appointmentId ?? null;
  }
}
