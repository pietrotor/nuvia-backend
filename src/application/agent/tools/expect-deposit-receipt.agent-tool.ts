import { Injectable } from '@nestjs/common';

import { ExpectDepositReceiptUseCase } from '@application/deposits/use-cases/expect-deposit-receipt.use-case';
import { AgentContext, AgentTool, AgentToolResult } from './agent-tool';
import { asObject, requiredUuid } from './tool-input';

@Injectable()
export class ExpectDepositReceiptAgentTool implements AgentTool {
  readonly definition = {
    name: 'expect_deposit_receipt',
    description:
      'Registra para qué cita será la próxima imagen cuando la clienta anuncia que enviará otro comprobante.',
    parameters: {
      type: 'object',
      additionalProperties: false,
      required: ['appointmentId'],
      properties: {
        appointmentId: {
          type: 'string',
          description:
            'Id de la cita que debe recibir la próxima imagen, obtenido de list_my_appointments',
        },
      },
    },
  };

  constructor(private readonly expectReceipt: ExpectDepositReceiptUseCase) {}

  async execute(
    input: unknown,
    context: AgentContext,
  ): Promise<AgentToolResult> {
    const values = asObject(input);
    await this.expectReceipt.execute({
      conversationId: context.conversationId,
      clientId: context.clientId,
      appointmentId: requiredUuid(values, 'appointmentId'),
    });
    return {
      status: 'success',
      summary: 'La próxima imagen se asignará a la cita indicada.',
      nextActions: ['Pedile que envíe el comprobante ahora.'],
    };
  }
}
