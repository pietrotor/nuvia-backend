export enum MessageDirection {
  INBOUND = 'inbound',
  OUTBOUND = 'outbound',
}

export enum MessageKind {
  TEXT = 'text',
  AUDIO = 'audio',
  IMAGE = 'image',
  OTHER = 'other',
}

export interface MessageProps {
  id: string;
  tenantId: string;
  conversationId: string;
  providerMessageId: string;
  inReplyToProviderMessageId: string | null;
  direction: MessageDirection;
  kind: MessageKind;
  content: string | null;
  promptFingerprint?: string | null;
  occurredAt: Date;
}

export class Message {
  public readonly id: string;
  public readonly tenantId: string;
  public readonly conversationId: string;
  public readonly providerMessageId: string;
  public readonly inReplyToProviderMessageId: string | null;
  public readonly direction: MessageDirection;
  public readonly kind: MessageKind;
  public readonly content: string | null;
  // Only on the agent's own outbound messages: identifies the prompt that produced them.
  public readonly promptFingerprint: string | null;
  public readonly occurredAt: Date;

  constructor(props: MessageProps) {
    this.id = props.id;
    this.tenantId = props.tenantId;
    this.conversationId = props.conversationId;
    this.providerMessageId = props.providerMessageId;
    this.inReplyToProviderMessageId = props.inReplyToProviderMessageId;
    this.direction = props.direction;
    this.kind = props.kind;
    this.content = props.content;
    this.promptFingerprint = props.promptFingerprint ?? null;
    this.occurredAt = props.occurredAt;
  }
}
