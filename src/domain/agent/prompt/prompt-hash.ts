// FNV-1a, implemented here so the domain stays free of Node built-ins. It is not a
// cryptographic hash: it only has to change when the text changes, so a stored
// fingerprint can be traced back to the prompt that produced a message.
export function promptHash(text: string): string {
  let hash = 0x811c9dc5;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(16).padStart(8, '0');
}
