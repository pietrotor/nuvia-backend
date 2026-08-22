export enum ReceiptImageClassification {
  RECEIPT = 'receipt',
  NOT_RECEIPT = 'not_receipt',
  UNKNOWN = 'unknown',
}

export interface ReceiptImageClassifierPort {
  classify(input: {
    bytes: Buffer;
    mimeType: string;
  }): Promise<ReceiptImageClassification>;
}

export const RECEIPT_IMAGE_CLASSIFIER_PORT = 'ReceiptImageClassifierPort';
