import { Injectable } from '@nestjs/common';

import { SendDepositQrUseCase } from '@application/deposits/use-cases/send-deposit-qr.use-case';
import { AppointmentNotFoundError } from '@domain/appointments/exceptions/appointment.exceptions';
import { AgentContext, AgentTool, AgentToolResult } from './agent-tool';
import { asObject, requiredUuid } from './tool-input';

@Injectable()
export class ResendDepositQrAgentTool implements AgentTool {
  readonly definition = {
    name: 'resend_deposit_qr',
    description:
      'Reenvía el QR de la seña de una cita que espera el pago, cuando la clienta lo pide o dice que no le llegó.',
    parameters: {
      type: 'object',
      additionalProperties: false,
      required: ['appointmentId'],
      properties: {
        appointmentId: {
          type: 'string',
          description:
            'Id de la cita, tomado del bloque de agenda o de list_my_appointments. No es el id del servicio.',
        },
      },
    },
  };

  constructor(private readonly sendDepositQr: SendDepositQrUseCase) {}

  // Unlike the QR that follows a booking, this one goes out before the agent's text:
  // the client asked for it, so it is the answer rather than an addition to it.
  async execute(
    input: unknown,
    context: AgentContext,
  ): Promise<AgentToolResult> {
    const values = asObject(input);

    let appointmentId: string;
    try {
      appointmentId = requiredUuid(values, 'appointmentId');
    } catch {
      return this.unknownAppointment();
    }

    let result: Awaited<ReturnType<SendDepositQrUseCase['execute']>>;
    try {
      result = await this.sendDepositQr.execute({
        appointmentId,
        conversationId: context.conversationId,
        clientPhoneE164: context.clientPhoneE164,
      });
    } catch (error) {
      // Without this the model reads a generic failure and concludes the resend is not
      // allowed, so it hands off instead of retrying with the id of a real appointment.
      if (error instanceof AppointmentNotFoundError) {
        return this.unknownAppointment();
      }
      throw error;
    }

    switch (result.outcome) {
      case 'sent':
        return {
          status: 'success',
          summary: `QR reenviado por ${result.amount ?? 'la seña'}.`,
          nextActions: [
            'Avisar que el QR ya está en el chat, sin repetir el monto.',
          ],
        };
      case 'not_pending_deposit':
        return {
          status: 'warning',
          summary: 'Esa cita ya no está esperando la seña.',
          nextActions: [
            'Revisar el estado con list_my_appointments antes de hablar de la seña.',
          ],
        };
      case 'no_deposit_required':
        return {
          status: 'warning',
          summary: 'Ese servicio no cobra seña.',
          nextActions: ['Avisar que no hace falta pagar nada por adelantado.'],
        };
      case 'no_qr_configured':
        return {
          status: 'error',
          summary: 'El negocio todavía no tiene un QR para cobrar la seña.',
          nextActions: [
            'No prometer un QR.',
            'Derivar con request_handoff para que el equipo pase los datos de pago.',
          ],
        };
    }
  }

  private unknownAppointment(): AgentToolResult {
    return {
      status: 'warning',
      summary:
        'No se envió nada: ese id no es de ninguna cita. El id de un servicio, de una profesional o de una sucursal no sirve acá.',
      nextActions: [
        'Copiar el id de la cita del bloque de agenda o de list_my_appointments y reintentar una sola vez.',
        'No decir que el QR salió: no salió.',
      ],
    };
  }
}
