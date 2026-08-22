export const DepositOutboundCopy = {
  qrCaption(input: {
    serviceName: string;
    amount: string;
    startsAtLabel: string;
  }): string {
    return [
      `Para confirmar tu turno de ${input.serviceName} el ${input.startsAtLabel} necesitamos una seña de ${input.amount}.`,
      'Escaneá este QR con la app de tu banco.',
      'Cuando hagas la transferencia, mandame por acá la captura del comprobante. El equipo la verifica y te aviso en cuanto tu turno quede confirmado.',
    ].join('\n\n');
  },
  receiptReceived(input: {
    serviceName: string;
    startsAtLabel: string;
    anotherPendingLabel?: string;
  }): string {
    const lines = [
      `Recibí tu comprobante para ${input.serviceName} el ${input.startsAtLabel}.`,
      'En cuanto el equipo lo confirme, te aviso.',
    ];
    if (input.anotherPendingLabel) {
      lines.push(
        `Tenés otro turno esperando seña el ${input.anotherPendingLabel}. Si esta captura era para ese, avisame.`,
      );
    }
    return lines.join('\n');
  },
  imageIsNotReceipt:
    'Esta imagen no parece ser el comprobante. Mandame la captura que te da la app del banco después de hacer la transferencia.',
  receiptNeedsAssignment(options: string[]): string {
    return [
      'Recibí y guardé tu comprobante, pero tenés más de un turno esperando seña.',
      '¿Para cuál es?',
      ...options.map((option, index) => `${index + 1}. ${option}`),
    ].join('\n');
  },
  paidWithoutReceipt:
    'Para que el equipo pueda verificar la seña, mandame por acá la captura del comprobante de tu banco.',
  depositVerified:
    'Listo, el equipo verificó tu seña y tu turno quedó confirmado.',
} as const;
