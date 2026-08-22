import { ReceiptImageClassification } from '../ports/receipt-image-classifier.port';

const RECEIPT_TERMS = [
  'beneficiario',
  'banco',
  'comprobante',
  'cuenta',
  'importe',
  'monto',
  'operacion',
  'pago',
  'nro',
  'qr',
  'transferencia',
  'transaccion',
] as const;

const SUCCESS_TERMS = [
  'aprobada',
  'completada',
  'exitosa',
  'realizada',
] as const;
const CURRENCY_PATTERN = /\b(?:bs|bob)\.?\s*\d+(?:[.,]\d{1,2})?\b/i;
const REFERENCE_PATTERN = /\b\d{4,}\b/;

export function classifyReceiptText(text: string): ReceiptImageClassification {
  const normalized = text
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase();
  if (normalized.trim().length < 8) {
    return ReceiptImageClassification.NOT_RECEIPT;
  }

  const receiptTerms = RECEIPT_TERMS.filter((term) =>
    normalized.includes(term),
  ).length;
  const successTerms = SUCCESS_TERMS.filter((term) =>
    normalized.includes(term),
  ).length;
  const hasCurrency = CURRENCY_PATTERN.test(normalized);
  const hasReference = REFERENCE_PATTERN.test(normalized);
  const score =
    receiptTerms +
    successTerms +
    Number(hasCurrency) * 2 +
    Number(hasReference);

  return score >= 2
    ? ReceiptImageClassification.RECEIPT
    : ReceiptImageClassification.NOT_RECEIPT;
}
