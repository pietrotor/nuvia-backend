import { DepositQr } from '../entities/deposit-qr.entity';

export interface CreateDepositQrData {
  branchId?: string | null;
  label: string;
  storageKey: string;
  mimeType: string;
  sizeBytes: number;
  isDefault?: boolean;
}

export interface FindDepositQrsOptions {
  includeArchived?: boolean;
  // Undefined returns every scope; null returns tenant-wide QRs only.
  branchId?: string | null;
}

export interface DepositQrRepository {
  create(data: CreateDepositQrData): Promise<DepositQr>;
  save(depositQr: DepositQr): Promise<DepositQr>;
  findById(id: string): Promise<DepositQr | null>;
  findAll(options?: FindDepositQrsOptions): Promise<DepositQr[]>;
  // Demoting the previous default and promoting this one is a single transaction.
  // The database allows one active default per branch plus one tenant-wide default.
  promoteToDefault(id: string): Promise<DepositQr | null>;
  assignBranchToAllWithoutBranch(branchId: string): Promise<number>;
  deleteAllUnscoped(): Promise<void>;
}

export const DEPOSIT_QR_REPOSITORY = 'DepositQrRepository';
