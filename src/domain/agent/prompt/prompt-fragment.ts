export enum PromptLayer {
  PLATFORM = 'platform',
  CHANNEL = 'channel',
  CATEGORY = 'category',
  TENANT = 'tenant',
  GUARD = 'guard',
  VOLATILE = 'volatile',
}

export enum PromptChannel {
  WHATSAPP = 'whatsapp',
}

export interface PromptFragment {
  key: string;
  layer: PromptLayer;
  lines: string[];
}

// Authority order inside the prompt: a lower layer can add constraints but never undo
// what an upper one stated. GUARD closes the static block by restating that precedence,
// and VOLATILE is data (current time), kept apart so the static block stays cacheable.
export const LAYER_ORDER: readonly PromptLayer[] = [
  PromptLayer.PLATFORM,
  PromptLayer.CHANNEL,
  PromptLayer.CATEGORY,
  PromptLayer.TENANT,
  PromptLayer.GUARD,
];
