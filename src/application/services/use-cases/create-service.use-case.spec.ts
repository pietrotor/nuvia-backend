import { AuditRecorder } from '@application/audit/services/audit-recorder.service';
import {
  AgentTone,
  BusinessConfig,
  WeeklyHours,
} from '@domain/business-config/entities/business-config.entity';
import { BusinessConfigRepository } from '@domain/business-config/repositories/business-config.repository';
import { Currency } from '@domain/common/value-objects/currency.vo';
import { Professional } from '@domain/professionals/entities/professional.entity';
import { ProfessionalRepository } from '@domain/professionals/repositories/professional.repository';
import { Service } from '@domain/services/entities/service.entity';
import {
  CreateServiceData,
  ServiceRepository,
} from '@domain/services/repositories/service.repository';
import { CreateServiceUseCase } from './create-service.use-case';

const hours: WeeklyHours = {
  mon: { start: '09:00', end: '18:00' },
  tue: null,
  wed: null,
  thu: null,
  fri: null,
  sat: null,
  sun: null,
};

const businessConfig = (currency: Currency): BusinessConfig =>
  new BusinessConfig({
    id: 'bc1',
    tenantId: 't1',
    slug: 'estetica-glow',
    agentName: 'Vale',
    tone: AgentTone.WARM,
    currency,
    businessHours: hours,
    bookingPolicy: {
      minLeadTimeHours: 2,
      cancelRescheduleHours: 24,
      noShowMessage: 'Avisanos.',
    },
    faq: {},
  });

describe('CreateServiceUseCase', () => {
  let serviceRepository: jest.Mocked<Pick<ServiceRepository, 'create'>>;
  let businessConfigRepository: jest.Mocked<
    Pick<BusinessConfigRepository, 'findByTenant'>
  >;
  let useCase: CreateServiceUseCase;

  const dto = {
    name: 'Limpieza facial',
    durationMinutes: 60,
    price: '150.00',
    professionalIds: ['p1'],
  };

  beforeEach(() => {
    serviceRepository = {
      create: jest.fn((data: CreateServiceData) =>
        Promise.resolve(
          new Service({
            id: 's1',
            tenantId: 't1',
            name: data.name,
            durationMinutes: data.durationMinutes,
            currency: data.currency,
            price: data.price,
            requiresDeposit: false,
            depositAmount: null,
            depositPercent: null,
            isActive: true,
            professionalIds: data.professionalIds,
          }),
        ),
      ),
    };
    businessConfigRepository = {
      findByTenant: jest.fn().mockResolvedValue(businessConfig(Currency.USD)),
    };
    const professionalRepository: jest.Mocked<
      Pick<ProfessionalRepository, 'findById'>
    > = {
      findById: jest.fn().mockResolvedValue({ id: 'p1' } as Professional),
    };
    const audit: jest.Mocked<Pick<AuditRecorder, 'record'>> = {
      record: jest.fn(),
    };

    useCase = new CreateServiceUseCase(
      serviceRepository as unknown as ServiceRepository,
      professionalRepository as unknown as ProfessionalRepository,
      businessConfigRepository as unknown as BusinessConfigRepository,
      audit as unknown as AuditRecorder,
    );
  });

  it('prices the service in the currency of the business when none is given', async () => {
    const created = await useCase.execute(dto);

    expect(created.price.display()).toBe('$ 150');
    expect(serviceRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({ currency: Currency.USD, price: '150.00' }),
    );
  });

  it('lets a service override the currency of the business', async () => {
    const created = await useCase.execute({
      ...dto,
      currency: Currency.BOB,
    });

    expect(created.price.display()).toBe('Bs 150');
    expect(businessConfigRepository.findByTenant).not.toHaveBeenCalled();
  });
});
