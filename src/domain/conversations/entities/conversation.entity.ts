export enum ConversationAttentionState {
  AI_ACTIVE = 'ai_active',
  WAITING_HUMAN = 'waiting_human',
  HUMAN_ATTENDING = 'human_attending',
}

export interface ConversationProps {
  id: string;
  tenantId: string;
  branchId?: string | null;
  clientId: string | null;
  clientPhoneE164: string;
  botPaused: boolean;
  botPausedAt: Date | null;
  handoffReason: string | null;
  lastActivityAt: Date;
}

export class Conversation {
  public readonly id: string;
  public readonly tenantId: string;
  public readonly branchId: string | null;
  public readonly clientId: string | null;
  public readonly clientPhoneE164: string;
  public readonly botPaused: boolean;
  public readonly botPausedAt: Date | null;
  public readonly handoffReason: string | null;
  public readonly lastActivityAt: Date;

  constructor(props: ConversationProps) {
    this.id = props.id;
    this.tenantId = props.tenantId;
    this.branchId = props.branchId ?? null;
    this.clientId = props.clientId;
    this.clientPhoneE164 = props.clientPhoneE164;
    this.botPaused = props.botPaused;
    this.botPausedAt = props.botPausedAt;
    this.handoffReason = props.handoffReason;
    this.lastActivityAt = props.lastActivityAt;
  }

  // The inbox highlights escalated conversations: bot paused with a reason.
  needsAttention(): boolean {
    return this.attentionState() === ConversationAttentionState.WAITING_HUMAN;
  }

  attentionState(): ConversationAttentionState {
    if (!this.botPaused) {
      return ConversationAttentionState.AI_ACTIVE;
    }
    if (this.handoffReason !== null) {
      return ConversationAttentionState.WAITING_HUMAN;
    }
    return ConversationAttentionState.HUMAN_ATTENDING;
  }
}
