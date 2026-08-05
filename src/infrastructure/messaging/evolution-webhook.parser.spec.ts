import { MessageKind } from '@domain/conversations/entities/message.entity';
import { EvolutionWebhookParser } from './evolution-webhook.parser';

describe('EvolutionWebhookParser', () => {
  const parser = new EvolutionWebhookParser();

  it('normalizes a direct inbound text message', () => {
    const result = parser.parse({
      data: {
        key: {
          id: 'message-1',
          remoteJid: '59170000000@s.whatsapp.net',
          fromMe: false,
        },
        pushName: 'Ana',
        message: { conversation: 'Quiero reservar' },
        messageType: 'conversation',
        messageTimestamp: 1_785_688_800,
      },
    });

    expect(result).toEqual({
      providerMessageId: 'message-1',
      clientPhoneE164: '+59170000000',
      clientName: 'Ana',
      kind: MessageKind.TEXT,
      content: 'Quiero reservar',
      occurredAt: new Date(1_785_688_800_000),
    });
  });

  it.each([
    {
      data: {
        key: {
          id: 'own',
          remoteJid: '59170000000@s.whatsapp.net',
          fromMe: true,
        },
      },
    },
    {
      data: {
        key: {
          id: 'group',
          remoteJid: '123@g.us',
          fromMe: false,
        },
      },
    },
  ])('ignores own and group messages', (payload) => {
    expect(parser.parse(payload)).toBeNull();
  });

  it('uses the alternate stable JID for LID messages', () => {
    const result = parser.parse({
      data: {
        key: {
          id: 'lid-message',
          remoteJid: '123@lid',
          remoteJidAlt: '59171111111@s.whatsapp.net',
          fromMe: false,
        },
        message: { extendedTextMessage: { text: 'Hola' } },
      },
    });

    expect(result?.clientPhoneE164).toBe('+59171111111');
    expect(result?.content).toBe('Hola');
  });
});
