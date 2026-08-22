import { ReceiptImageClassification } from '../ports/receipt-image-classifier.port';
import { classifyReceiptText } from './receipt-text-classifier';

describe('classifyReceiptText', () => {
  it('accepts common Bolivian transfer receipt wording', () => {
    expect(
      classifyReceiptText(
        'Transferencia exitosa\nMonto Bs 50,00\nNro. de operación 12345678',
      ),
    ).toBe(ReceiptImageClassification.RECEIPT);
  });

  it('rejects images whose extracted text is unrelated to a payment', () => {
    expect(classifyReceiptText('Perrito feliz en el parque')).toBe(
      ReceiptImageClassification.NOT_RECEIPT,
    );
    expect(classifyReceiptText('')).toBe(
      ReceiptImageClassification.NOT_RECEIPT,
    );
  });

  it('requires more than one weak payment hint', () => {
    expect(classifyReceiptText('Cuenta de Instagram: nuvia')).toBe(
      ReceiptImageClassification.NOT_RECEIPT,
    );
  });
});
