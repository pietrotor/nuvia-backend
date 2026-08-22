import {
  DepositReceipt,
  DepositReceiptClassification,
  DepositReceiptSource,
} from '../entities/deposit-receipt.entity';

export interface CreateDepositReceiptData {
  conversationId: string | null;
  clientId: string;
  providerMessageId: string | null;
  storageKey: string;
  mimeType: string;
  receivedAt: Date;
  source: DepositReceiptSource;
  classification: DepositReceiptClassification;
}

export interface DepositReceiptRepository {
  create(data: CreateDepositReceiptData): Promise<DepositReceipt>;
  findById(id: string): Promise<DepositReceipt | null>;
  findByIdForUpdate(id: string): Promise<DepositReceipt | null>;
  findByProviderMessageId(
    providerMessageId: string,
  ): Promise<DepositReceipt | null>;
  findActiveByAppointment(
    appointmentId: string,
  ): Promise<DepositReceipt | null>;
  findLatestForConversation(
    conversationId: string,
  ): Promise<DepositReceipt | null>;
  findLatestPendingForConversation(
    conversationId: string,
  ): Promise<DepositReceipt | null>;
  assign(input: {
    receiptId: string;
    appointmentId: string;
    supersededAt: Date;
  }): Promise<DepositReceipt | null>;
  expectNext(input: {
    conversationId: string;
    clientId: string;
    appointmentId: string;
    expiresAt: Date;
    now: Date;
  }): Promise<void>;
  consumeExpectation(input: {
    conversationId: string;
    now: Date;
  }): Promise<string | null>;
  findExpectedAppointment(input: {
    conversationId: string;
    now: Date;
  }): Promise<string | null>;
}

export const DEPOSIT_RECEIPT_REPOSITORY = 'DepositReceiptRepository';
