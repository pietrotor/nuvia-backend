import { Inject, Injectable } from '@nestjs/common';

import { AssignDepositReceiptUseCase } from '@application/deposits/use-cases/assign-deposit-receipt.use-case';
import {
  DEPOSIT_RECEIPT_REPOSITORY,
  DepositReceiptRepository,
} from '@domain/deposits/repositories/deposit-receipt.repository';
import {
  MESSAGE_REPOSITORY,
  MessageRepository,
} from '@domain/conversations/repositories/message.repository';
import { AgentContext, AgentTool, AgentToolResult } from './agent-tool';
import { asObject, optionalString, requiredUuid } from './tool-input';

@Injectable()
export class AssignDepositReceiptAgentTool implements AgentTool {
  readonly definition = {
    name: 'assign_deposit_receipt',
    description:
      'Asigna o corrige un comprobante a una cita pendiente de seña. Usa receiptProviderMessageId cuando el historial muestre la referencia; si la clienta cita un QR, la cita vinculada al QR prevalece.',
    parameters: {
      type: 'object',
      additionalProperties: false,
      required: ['appointmentId'],
      properties: {
        appointmentId: {
          type: 'string',
          description:
            'Id de la cita correcta, obtenido de list_my_appointments',
        },
        receiptProviderMessageId: {
          type: 'string',
          description:
            'Referencia exacta del comprobante mostrada en el historial. Omitir solo si hay un único comprobante pendiente o se citó su imagen.',
        },
      },
    },
  };

  constructor(
    @Inject(DEPOSIT_RECEIPT_REPOSITORY)
    private readonly receipts: DepositReceiptRepository,
    @Inject(MESSAGE_REPOSITORY)
    private readonly messages: MessageRepository,
    private readonly assignReceipt: AssignDepositReceiptUseCase,
  ) {}

  async execute(
    input: unknown,
    context: AgentContext,
  ): Promise<AgentToolResult> {
    const values = asObject(input);
    const requestedAppointmentId = requiredUuid(values, 'appointmentId');
    const explicitReceiptProviderId = optionalString(
      values,
      'receiptProviderMessageId',
    );
    const quotedReceipt = context.quotedProviderMessageId
      ? await this.receipts.findByProviderMessageId(
          context.quotedProviderMessageId,
        )
      : null;
    const quotedMessage = context.quotedProviderMessageId
      ? await this.messages.findByProviderMessageId(
          context.quotedProviderMessageId,
        )
      : null;
    const appointmentId =
      quotedMessage?.relatedAppointmentId ?? requestedAppointmentId;
    const explicitlyReferencedReceipt = explicitReceiptProviderId
      ? await this.receipts.findByProviderMessageId(explicitReceiptProviderId)
      : null;
    if (
      explicitReceiptProviderId &&
      (!explicitlyReferencedReceipt ||
        explicitlyReferencedReceipt.conversationId !== context.conversationId)
    ) {
      return {
        status: 'warning',
        summary:
          'La referencia del comprobante no existe en esta conversación.',
        nextActions: [
          'Revisá el historial y copiá exactamente la referencia de la imagen correcta.',
        ],
      };
    }
    const receipt =
      explicitlyReferencedReceipt ??
      quotedReceipt ??
      (await this.receipts.findLatestPendingForConversation(
        context.conversationId,
      ));
    if (!receipt) {
      return {
        status: 'warning',
        summary: 'No hay un comprobante reciente para asignar.',
        nextActions: ['Pedile que envíe la captura del comprobante.'],
      };
    }

    await this.assignReceipt.execute({
      receiptId: receipt.id,
      appointmentId,
      source: 'agent',
    });
    return {
      status: 'success',
      summary: 'El comprobante quedó asignado a la cita indicada.',
      nextActions: [
        'Confirmá brevemente la corrección sin decir que el pago ya fue verificado.',
      ],
    };
  }
}
