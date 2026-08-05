import { Injectable } from '@nestjs/common';

import { GetBusinessConfigUseCase } from '@application/business-config/use-cases/get-business-config.use-case';
import { AgentContext, AgentTool, AgentToolResult } from './agent-tool';

@Injectable()
export class GetBusinessInfoAgentTool implements AgentTool {
  readonly definition = {
    name: 'get_business_info',
    description:
      'Obtiene dirección, horarios, preguntas frecuentes y políticas del negocio.',
    parameters: { type: 'object', properties: {}, additionalProperties: false },
  };

  constructor(private readonly getConfig: GetBusinessConfigUseCase) {}

  async execute(
    _input: unknown,
    _context: AgentContext,
  ): Promise<AgentToolResult> {
    const config = await this.getConfig.execute();
    return {
      status: 'success',
      summary: 'Información del negocio encontrada.',
      data: {
        address: config.address,
        businessHours: config.businessHours,
        bookingPolicy: config.bookingPolicy,
        faq: config.faq,
      },
    };
  }
}
