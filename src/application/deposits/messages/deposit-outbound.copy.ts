export const DepositOutboundCopy = {
  // Caption of the QR image. It promises verification by a person and never suggests
  // the deposit is already settled. It asks the client to say she paid rather than to
  // send the receipt: the agent cannot claim to read images, and nothing downstream
  // stores one yet.
  qrCaption(input: { serviceName: string; amount: string }): string {
    return [
      `Para confirmar tu turno de ${input.serviceName} necesitamos una seña de ${input.amount}.`,
      'Escaneá este QR con la app de tu banco.',
      'Cuando hagas la transferencia avisame por acá: el equipo la verifica y te aviso en cuanto tu turno quede confirmado.',
    ].join('\n\n');
  },
} as const;
