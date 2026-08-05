import { Injectable } from '@nestjs/common';

import { GetAvailabilityUseCase } from '@application/appointments/use-cases/get-availability.use-case';
import { AgentContext, AgentTool, AgentToolResult } from './agent-tool';
import { asObject, requiredIsoDate, requiredUuid } from './tool-input';

@Injectable()
export class FindAvailabilityAgentTool implements AgentTool {
  readonly definition = {
    name: 'find_availability',
    description:
      'Busca horarios reales disponibles para un servicio y profesional.',
    parameters: {
      type: 'object',
      additionalProperties: false,
      required: ['serviceId', 'professionalId', 'from', 'to'],
      properties: {
        serviceId: { type: 'string', description: 'UUID del servicio' },
        professionalId: { type: 'string', description: 'UUID del profesional' },
        from: { type: 'string', description: 'Inicio ISO 8601' },
        to: { type: 'string', description: 'Fin ISO 8601' },
      },
    },
  };

  constructor(private readonly getAvailability: GetAvailabilityUseCase) {}

  async execute(
    input: unknown,
    _context: AgentContext,
  ): Promise<AgentToolResult> {
    const values = asObject(input);
    const from = requiredIsoDate(values, 'from');
    const to = requiredIsoDate(values, 'to');
    const rangeMs = Date.parse(to) - Date.parse(from);
    if (rangeMs <= 0 || rangeMs > 14 * 24 * 60 * 60 * 1000) {
      throw new Error(
        'Availability range must be positive and at most 14 days',
      );
    }
    const slots = await this.getAvailability.execute({
      serviceId: requiredUuid(values, 'serviceId'),
      professionalId: requiredUuid(values, 'professionalId'),
      from,
      to,
    });
    return {
      status: 'success',
      summary: `${slots.length} horarios disponibles encontrados.`,
      data: slots,
      nextActions: slots.length
        ? ['Confirmar servicio, profesional y horario con la clienta.']
        : ['Probar otro rango o profesional.'],
    };
  }
}
