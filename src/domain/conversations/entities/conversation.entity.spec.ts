import {
  Conversation,
  ConversationAttentionState,
} from './conversation.entity';

describe('Conversation.attentionState', () => {
  const base = {
    id: 'cv1',
    tenantId: 't1',
    clientId: 'c1',
    clientPhoneE164: '+59170000001',
    botPausedAt: null as Date | null,
    lastActivityAt: new Date('2026-08-04T12:00:00.000Z'),
  };

  it('is ai_active while the bot is attending', () => {
    const conversation = new Conversation({
      ...base,
      botPaused: false,
      handoffReason: null,
    });

    expect(conversation.attentionState()).toBe(
      ConversationAttentionState.AI_ACTIVE,
    );
    expect(conversation.needsAttention()).toBe(false);
  });

  it('is waiting_human after an agent handoff with a reason', () => {
    const conversation = new Conversation({
      ...base,
      botPaused: true,
      botPausedAt: new Date('2026-08-04T12:00:00.000Z'),
      handoffReason: 'Cliente pide hablar con una persona',
    });

    expect(conversation.attentionState()).toBe(
      ConversationAttentionState.WAITING_HUMAN,
    );
    expect(conversation.needsAttention()).toBe(true);
  });

  it('is human_attending when staff paused or replied without handoff reason', () => {
    const conversation = new Conversation({
      ...base,
      botPaused: true,
      botPausedAt: new Date('2026-08-04T12:00:00.000Z'),
      handoffReason: null,
    });

    expect(conversation.attentionState()).toBe(
      ConversationAttentionState.HUMAN_ATTENDING,
    );
    expect(conversation.needsAttention()).toBe(false);
  });
});
