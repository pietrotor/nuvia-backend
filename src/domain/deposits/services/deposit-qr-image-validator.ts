import { InvalidDepositQrFileError } from '../exceptions/deposit-qr.exceptions';

// The owner uploads a screenshot of the QR from her banking app, so the set is the
// image formats a phone produces.
export const DEPOSIT_QR_ALLOWED_MIME_TYPES = [
  'image/png',
  'image/jpeg',
  'image/webp',
] as const;

export const DEPOSIT_QR_MAX_SIZE_BYTES = 2 * 1024 * 1024;

export const DEPOSIT_QR_MAX_SIZE_MB = DEPOSIT_QR_MAX_SIZE_BYTES / (1024 * 1024);

// The declared content type is whatever the uploader claims. Anything that is not
// really an image is only rejected later by WhatsApp, when the client is already
// waiting for a QR that will never arrive, so the bytes are checked here instead.
const SIGNATURES_BY_MIME_TYPE: Record<string, number[][]> = {
  'image/png': [[0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]],
  'image/jpeg': [[0xff, 0xd8, 0xff]],
  // RIFF container: "RIFF" plus "WEBP" after the four size bytes.
  'image/webp': [[0x52, 0x49, 0x46, 0x46]],
};

const WEBP_FORMAT_OFFSET = 8;
const WEBP_FORMAT = [0x57, 0x45, 0x42, 0x50];

function startsWith(
  bytes: Uint8Array,
  signature: number[],
  offset = 0,
): boolean {
  return signature.every((byte, index) => bytes[offset + index] === byte);
}

function matchesDeclaredType(bytes: Uint8Array, mimeType: string): boolean {
  const signatures = SIGNATURES_BY_MIME_TYPE[mimeType];
  if (!signatures) return false;
  if (!signatures.some((signature) => startsWith(bytes, signature)))
    return false;

  return mimeType === 'image/webp'
    ? startsWith(bytes, WEBP_FORMAT, WEBP_FORMAT_OFFSET)
    : true;
}

export function assertValidDepositQrImage(input: {
  mimeType: string;
  body: Uint8Array;
}): void {
  const isAllowedType = DEPOSIT_QR_ALLOWED_MIME_TYPES.some(
    (mimeType) => mimeType === input.mimeType,
  );
  const sizeBytes = input.body.length;
  const isAllowedSize = sizeBytes > 0 && sizeBytes <= DEPOSIT_QR_MAX_SIZE_BYTES;

  if (
    !isAllowedType ||
    !isAllowedSize ||
    !matchesDeclaredType(input.body, input.mimeType)
  ) {
    throw new InvalidDepositQrFileError(DEPOSIT_QR_MAX_SIZE_MB);
  }
}
