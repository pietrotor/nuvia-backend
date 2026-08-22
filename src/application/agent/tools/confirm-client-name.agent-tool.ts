import { Injectable } from '@nestjs/common';

import { ConfirmClientNameUseCase } from '@application/clients/use-cases/confirm-client-name.use-case';
import { ClientNameRequiredError } from '@domain/appointments/exceptions/appointment.exceptions';
import { AgentContext, AgentTool, AgentToolResult } from './agent-tool';
import { asObject, requiredString } from './tool-input';

@Injectable()
export class ConfirmClientNameAgentTool implements AgentTool {
  readonly definition = {
    name: 'confirm_client_name',
    description:
      'Guarda el nombre real de quien escribe, el que dijo en el chat. No uses el nombre del perfil de WhatsApp. Llamalo cuando te lo dé por primera vez o cuando lo corrija.',
    parameters: {
      type: 'object',
      additionalProperties: false,
      required: ['name'],
      properties: {
        name: {
          type: 'string',
          description: 'Nombre y, si lo dio, apellido. Tal cual lo escribió.',
        },
      },
    },
  };

  constructor(private readonly confirmClientName: ConfirmClientNameUseCase) {}

  async execute(
    input: unknown,
    context: AgentContext,
  ): Promise<AgentToolResult> {
    let name: string;
    try {
      name = requiredString(asObject(input), 'name');
    } catch {
      return {
        status: 'warning',
        summary: 'No se guardó ningún nombre: falta el dato.',
        nextActions: ['Preguntar cómo se llama.'],
      };
    }

    try {
      const client = await this.confirmClientName.execute({
        clientId: context.clientId,
        name,
      });
      return {
        status: 'success',
        summary: `Nombre guardado: ${client.name}.`,
        data: { clientId: client.id, name: client.name },
        nextActions: [
          'Usar ese nombre al confirmar. Seguir con lo que pidió, sin repetir la pregunta.',
        ],
      };
    } catch (error) {
      if (error instanceof ClientNameRequiredError) {
        return {
          status: 'warning',
          summary:
            'Eso no sirve como nombre (iniciales, número o el nombre del perfil).',
          nextActions: [
            'Pedir el nombre de pila, el que usamos para la reserva.',
          ],
        };
      }
      throw error;
    }
  }
}
