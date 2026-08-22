import { createHash, randomInt } from 'node:crypto';

const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export function generateActivationCode(): string {
  let code = '';
  for (let i = 0; i < 6; i += 1) {
    code += ALPHABET[randomInt(ALPHABET.length)];
  }
  return code;
}

export function hashActivationCode(input: {
  tenantId: string;
  code: string;
}): string {
  return createHash('sha256')
    .update(`${input.tenantId}:${input.code.toUpperCase()}`)
    .digest('hex');
}
