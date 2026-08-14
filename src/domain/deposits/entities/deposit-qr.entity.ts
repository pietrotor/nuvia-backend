export interface DepositQrProps {
  id: string;
  tenantId: string;
  branchId?: string | null;
  label: string;
  storageKey: string;
  mimeType: string;
  sizeBytes: number;
  isDefault: boolean;
  isActive: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

// A payment QR of the business, uploaded once and reused on every deposit request.
// It holds the storage key, never a provider URL: the URL is derived when reading so
// that changing storage provider is a new adapter, not a data migration.
export class DepositQr {
  public readonly id: string;
  public readonly tenantId: string;
  public readonly branchId: string | null;
  public readonly label: string;
  public readonly storageKey: string;
  public readonly mimeType: string;
  public readonly sizeBytes: number;
  // The one used when a service does not point to a specific QR.
  public readonly isDefault: boolean;
  public readonly isActive: boolean;
  public readonly createdAt?: Date;
  public readonly updatedAt?: Date;

  constructor(props: DepositQrProps) {
    this.id = props.id;
    this.tenantId = props.tenantId;
    this.branchId = props.branchId ?? null;
    this.label = props.label;
    this.storageKey = props.storageKey;
    this.mimeType = props.mimeType;
    this.sizeBytes = props.sizeBytes;
    this.isDefault = props.isDefault;
    this.isActive = props.isActive;
    this.createdAt = props.createdAt;
    this.updatedAt = props.updatedAt;
  }

  rename(label: string): DepositQr {
    return new DepositQr({ ...this, label });
  }

  // Nothing is deleted: an unused QR is archived. Archiving the default also gives up
  // the default, otherwise deposits would keep being requested with a retired account.
  archive(): DepositQr {
    return new DepositQr({ ...this, isActive: false, isDefault: false });
  }

  restore(): DepositQr {
    return new DepositQr({ ...this, isActive: true });
  }
}
