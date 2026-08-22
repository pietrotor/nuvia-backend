import { InvalidDepositReceiptFileError } from '../exceptions/deposit-qr.exceptions';
import {
  DEPOSIT_QR_MAX_SIZE_MB,
  isValidDepositImage,
} from './deposit-qr-image-validator';

export function assertValidDepositReceiptImage(input: {
  mimeType: string;
  body: Uint8Array;
}): void {
  if (!isValidDepositImage(input)) {
    throw new InvalidDepositReceiptFileError(DEPOSIT_QR_MAX_SIZE_MB);
  }
}
