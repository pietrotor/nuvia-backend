import {
  Appointment,
  AppointmentStatus,
} from '@domain/appointments/entities/appointment.entity';
import { AppointmentNotFoundError } from '@domain/appointments/exceptions/appointment.exceptions';
import {
  AppointmentView,
  AppointmentViewRepository,
} from '@domain/appointments/repositories/appointment-view.repository';
import { Currency } from '@domain/common/value-objects/currency.vo';
import { Money } from '@domain/common/value-objects/money.vo';

import { GetAppointmentUseCase } from './get-appointment.use-case';

const view: AppointmentView = {
  appointment: new Appointment({
    id: 'a1',
    tenantId: 't1',
    branchId: 'b1',
    clientId: 'c1',
    bookingContactClientId: 'c1',
    professionalId: 'p1',
    serviceId: 's1',
    startsAt: new Date('2026-08-10T14:00:00.000Z'),
    endsAt: new Date('2026-08-10T15:00:00.000Z'),
    status: AppointmentStatus.CONFIRMED,
    price: Money.of('150.00', Currency.BOB),
  }),
  client: { id: 'c1', name: 'María López', phoneE164: '+59171234567' },
  bookingContact: { id: 'c1', name: 'María López', phoneE164: '+59171234567' },
  professional: { id: 'p1', name: 'Camila' },
  service: {
    id: 's1',
    name: 'Limpieza facial',
    durationMinutes: 60,
    price: Money.of('150.00', Currency.BOB),
    requiresDeposit: false,
  },
};

describe('GetAppointmentUseCase', () => {
  let appointmentViewRepository: jest.Mocked<
    Pick<AppointmentViewRepository, 'findById'>
  >;
  let useCase: GetAppointmentUseCase;

  beforeEach(() => {
    appointmentViewRepository = {
      findById: jest.fn().mockResolvedValue(view),
    };
    useCase = new GetAppointmentUseCase(
      appointmentViewRepository as unknown as AppointmentViewRepository,
    );
  });

  it('returns the appointment with the names a screen needs', async () => {
    const result = await useCase.execute('a1');

    expect(result.client.name).toBe('María López');
    expect(result.professional.name).toBe('Camila');
    expect(result.service.name).toBe('Limpieza facial');
  });

  it('reports an appointment of another business as missing', async () => {
    appointmentViewRepository.findById.mockResolvedValue(null);

    await expect(useCase.execute('a1')).rejects.toThrow(
      AppointmentNotFoundError,
    );
  });
});
