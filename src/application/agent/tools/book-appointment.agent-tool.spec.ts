import { BookAppointmentUseCase } from '@application/appointments/use-cases/book-appointment.use-case';
import { GetAppointmentUseCase } from '@application/appointments/use-cases/get-appointment.use-case';
import { GetBranchUseCase } from '@application/branches/use-cases/get-branch.use-case';
import { ResolveBookingAttendeeUseCase } from '@application/clients/use-cases/resolve-booking-attendee.use-case';
import { AppointmentStatus } from '@domain/appointments/entities/appointment.entity';
import { SlotUnavailableError } from '@domain/appointments/exceptions/appointment.exceptions';
import { Client } from '@domain/clients/entities/client.entity';
import { ServiceNotFoundError } from '@domain/services/exceptions/service.exceptions';
import { AgentContext } from './agent-tool';
import { BookAppointmentAgentTool } from './book-appointment.agent-tool';

const SERVICE_ID = 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d';
const PROFESSIONAL_ID = '2f6ba7e0-5c1a-4a5e-9a3f-1c0f7c9d2b11';
const CLIENT_ID = '9d8c7b6a-5f4e-4d3c-8b2a-1f0e9d8c7b6a';

const context: AgentContext = {
  tenantId: 'tenant-1',
  conversationId: 'conversation-1',
  clientId: CLIENT_ID,
  clientPhoneE164: '+59170000000',
  timezone: 'America/La_Paz',
  branchId: null,
};

const validInput = {
  serviceId: SERVICE_ID,
  professionalId: PROFESSIONAL_ID,
  startsAt: '2026-08-09T19:00:00-04:00',
  bookingForSelf: true,
  attendeeConfirmed: true,
  confirmedByClient: true,
};

const contact = new Client({
  id: CLIENT_ID,
  tenantId: 'tenant-1',
  name: 'Ana',
  phoneE164: '+59170000000',
  notes: null,
});

describe('BookAppointmentAgentTool', () => {
  let bookAppointment: { execute: jest.Mock };
  let resolveAttendee: { execute: jest.Mock };
  let getAppointment: { execute: jest.Mock };
  let getBranch: { execute: jest.Mock };
  let tool: BookAppointmentAgentTool;

  beforeEach(() => {
    bookAppointment = { execute: jest.fn() };
    resolveAttendee = { execute: jest.fn().mockResolvedValue(contact) };
    getAppointment = {
      execute: jest.fn().mockResolvedValue({
        client: { id: CLIENT_ID, name: 'Ana', phoneE164: '+59170000000' },
        service: { id: SERVICE_ID, name: 'Limpieza facial' },
        professional: { id: PROFESSIONAL_ID, name: 'Camila' },
      }),
    };
    getBranch = {
      execute: jest.fn().mockResolvedValue({
        id: 'branch-1',
        name: 'Sucursal Centro',
        address: 'Av. Principal 123',
        mapsUrl: 'https://maps.example/branch-1',
      }),
    };
    tool = new BookAppointmentAgentTool(
      bookAppointment as unknown as BookAppointmentUseCase,
      resolveAttendee as unknown as ResolveBookingAttendeeUseCase,
      getAppointment as unknown as GetAppointmentUseCase,
      getBranch as unknown as GetBranchUseCase,
    );
  });

  it('refuses to book before the client confirmed', async () => {
    const result = await tool.execute(
      { ...validInput, confirmedByClient: false },
      context,
    );

    expect(result.status).toBe('warning');
    expect(bookAppointment.execute).not.toHaveBeenCalled();
  });

  // The model reaches this turn with the identifiers it read several messages ago, or with
  // one it made up from the name. Either way the client deserves a reason, not a handoff.
  it('explains an invented identifier instead of failing opaquely', async () => {
    const result = await tool.execute(
      { ...validInput, serviceId: 'hidrafacial' },
      context,
    );

    expect(result.status).toBe('warning');
    expect(result.summary).toContain('No se reservó nada');
    expect(result.nextActions).toEqual(
      expect.arrayContaining([expect.stringContaining('catálogo')]),
    );
    expect(bookAppointment.execute).not.toHaveBeenCalled();
  });

  it('explains a date that is not ISO 8601', async () => {
    const result = await tool.execute(
      { ...validInput, startsAt: 'mañana a las 19:00' },
      context,
    );

    expect(result.status).toBe('warning');
    expect(bookAppointment.execute).not.toHaveBeenCalled();
  });

  it('says the slot cannot be taken rather than claiming the booking', async () => {
    bookAppointment.execute.mockRejectedValue(new SlotUnavailableError());

    const result = await tool.execute(validInput, context);

    expect(result.status).toBe('warning');
    expect(result.summary).toContain('no se puede reservar');
    expect(result.nextActions).toEqual(
      expect.arrayContaining([expect.stringContaining('find_availability')]),
    );
  });

  it('says so when the service no longer exists', async () => {
    bookAppointment.execute.mockRejectedValue(
      new ServiceNotFoundError(SERVICE_ID),
    );

    const result = await tool.execute(validInput, context);

    expect(result.status).toBe('warning');
    expect(result.summary).toContain('No existe ese servicio');
  });

  // A failure we cannot explain is a bug, and swallowing it into a warning would teach the
  // model to apologise for something we never got to see.
  it('lets an unexpected failure through', async () => {
    bookAppointment.execute.mockRejectedValue(new Error('connection lost'));

    await expect(tool.execute(validInput, context)).rejects.toThrow(
      'connection lost',
    );
  });

  it('asks for the deposit QR to follow when the service needs one', async () => {
    bookAppointment.execute.mockResolvedValue({
      id: 'appointment-1',
      branchId: 'branch-1',
      bookingContactClientId: CLIENT_ID,
      startsAt: new Date('2026-08-09T23:00:00.000Z'),
      endsAt: new Date('2026-08-10T00:15:00.000Z'),
      status: AppointmentStatus.PENDING_DEPOSIT,
    });

    const result = await tool.execute(validInput, context);

    expect(result.status).toBe('success');
    expect(result.followUp).toEqual({
      kind: 'deposit_qr',
      appointmentId: 'appointment-1',
    });
    expect(result.data).toEqual(
      expect.objectContaining({
        attendee: { clientId: CLIENT_ID, name: 'Ana' },
        service: { serviceId: SERVICE_ID, name: 'Limpieza facial' },
        professional: { professionalId: PROFESSIONAL_ID, name: 'Camila' },
        branch: {
          branchId: 'branch-1',
          name: 'Sucursal Centro',
          address: 'Av. Principal 123',
          mapsUrl: 'https://maps.example/branch-1',
        },
        dateLabel: 'domingo 9 de agosto de 2026',
        startsAtLabel: '19:00',
      }),
    );
  });
});
