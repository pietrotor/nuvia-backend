import { Injectable } from '@nestjs/common';

import { ListBookingAttendeesUseCase } from '@application/clients/use-cases/list-booking-attendees.use-case';
import { AgentContext, AgentTool, AgentToolResult } from './agent-tool';

@Injectable()
export class ListBookingAttendeesAgentTool implements AgentTool {
  readonly definition = {
    name: 'list_booking_attendees',
    description:
      'Lista las personas para las que este contacto ya reservó (además de sí misma). Usalo solo cuando diga que el turno no es para ella o corrija el "a nombre de" del resumen.',
    parameters: {
      type: 'object',
      additionalProperties: false,
      required: [],
      properties: {},
    },
  };

  constructor(
    private readonly listBookingAttendees: ListBookingAttendeesUseCase,
  ) {}

  async execute(
    _input: unknown,
    context: AgentContext,
  ): Promise<AgentToolResult> {
    const attendees = await this.listBookingAttendees.execute(context.clientId);
    return {
      status: 'success',
      summary: attendees.length
        ? `${attendees.length} persona(s) para las que ya reservó.`
        : 'Todavía no reservó para nadie más.',
      data: attendees.map((attendee) => ({
        clientId: attendee.id,
        name: attendee.name,
      })),
      nextActions: attendees.length
        ? [
            'Ofrecer esas personas por nombre y preguntar a nombre de quién queda.',
            'Si elige una de la lista, copiá su clientId en book_appointment con bookingForSelf false.',
          ]
        : [
            'Pedir el nombre de quien se atiende y volver a pedir confirmación del resumen.',
          ],
    };
  }
}
