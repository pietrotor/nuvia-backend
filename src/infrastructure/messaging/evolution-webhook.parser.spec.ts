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
      inReplyToProviderMessageId: null,
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

  it.each([
    {
      messageType: 'extendedTextMessage',
      message: {
        extendedTextMessage: {
          text: 'Era para el viernes',
          contextInfo: {
            stanzaId: 'quoted-receipt',
            quotedMessage: { imageMessage: { caption: '' } },
          },
        },
      },
      kind: MessageKind.TEXT,
    },
    {
      messageType: 'imageMessage',
      message: {
        imageMessage: {
          mimetype: 'image/jpeg',
          caption: 'Este es para el viernes',
          contextInfo: {
            stanzaId: 'quoted-qr',
            quotedMessage: { imageMessage: { caption: 'QR de seña' } },
          },
        },
      },
      kind: MessageKind.IMAGE,
    },
  ])(
    'extracts the quoted stanza from $messageType payloads',
    ({ messageType, message, kind }) => {
      const result = parser.parse({
        data: {
          key: {
            id: `incoming-${messageType}`,
            remoteJid: '59170000000@s.whatsapp.net',
            fromMe: false,
          },
          message,
          messageType,
        },
      });

      expect(result).toEqual(
        expect.objectContaining({
          kind,
          content:
            messageType === 'imageMessage'
              ? 'Este es para el viernes'
              : 'Era para el viernes',
          inReplyToProviderMessageId:
            messageType === 'imageMessage' ? 'quoted-qr' : 'quoted-receipt',
        }),
      );
    },
  );

  it('parses a MESSAGES_UPDATE delivery ack', () => {
    expect(
      parser.parseStatusUpdates({
        data: [{ key: { id: 'wamid.out' }, status: 'DELIVERY_ACK' }],
      }),
    ).toEqual([
      {
        providerMessageId: 'wamid.out',
        status: 'DELIVERY_ACK',
        statusCode: null,
      },
    ]);
  });
});
