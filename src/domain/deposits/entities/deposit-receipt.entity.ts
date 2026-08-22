export enum DepositReceiptStatus {
  PENDING_ASSIGNMENT = 'pending_assignment',
  ASSIGNED = 'assigned',
  SUPERSEDED = 'superseded',
}

export enum DepositReceiptSource {
  WHATSAPP = 'whatsapp',
  STAFF = 'staff',
}

export enum DepositReceiptClassification {
  RECEIPT = 'receipt',
  UNKNOWN = 'unknown',
  STAFF_UPLOAD = 'staff_upload',
}

export interface DepositReceiptProps {
  id: string;
  tenantId: string;
  conversationId: string | null;
  clientId: string;
  appointmentId: string | null;
  providerMessageId: string | null;
  storageKey: string;
  mimeType: string;
  receivedAt: Date;
  status: DepositReceiptStatus;
  source: DepositReceiptSource;
  classification: DepositReceiptClassification;
  supersededAt?: Date | null;
  createdAt?: Date;
  updatedAt?: Date;
}

export class DepositReceipt {
  public readonly id: string;
  public readonly tenantId: string;
  public readonly conversationId: string | null;
  public readonly clientId: string;
  public readonly appointmentId: string | null;
  public readonly providerMessageId: string | null;
  public readonly storageKey: string;
  public readonly mimeType: string;
  public readonly receivedAt: Date;
  public readonly status: DepositReceiptStatus;
  public readonly source: DepositReceiptSource;
  public readonly classification: DepositReceiptClassification;
  public readonly supersededAt: Date | null;
  public readonly createdAt?: Date;
  public readonly updatedAt?: Date;

  constructor(props: DepositReceiptProps) {
    Object.assign(this, props);
    this.supersededAt = props.supersededAt ?? null;
  }
}
