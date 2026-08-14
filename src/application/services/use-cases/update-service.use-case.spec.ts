import { AuditRecorder } from '@application/audit/services/audit-recorder.service';
import { Currency } from '@domain/common/value-objects/currency.vo';
import { Professional } from '@domain/professionals/entities/professional.entity';
import { ProfessionalRepository } from '@domain/professionals/repositories/professional.repository';
import { Service } from '@domain/services/entities/service.entity';
import { ServiceRepository } from '@domain/services/repositories/service.repository';
import { DepositQrAssignmentValidator } from '../services/deposit-qr-assignment-validator.service';
import { UpdateServiceUseCase } from './update-service.use-case';

const service = (): Service =>
  new Service({
    id: 's1',
    tenantId: 't1',
    name: 'Limpieza facial',
    durationMinutes: 60,
    currency: Currency.BOB,
    price: '150.00',
    requiresDeposit: false,
    depositAmount: null,
    depositPercent: null,
    depositQrId: null,
    clientChoosesProfessional: true,
    isActive: true,
    professionalIds: ['p1'],
  });

describe('UpdateServiceUseCase', () => {
  let serviceRepository: jest.Mocked<
    Pick<ServiceRepository, 'findById' | 'update'>
  >;
  let useCase: UpdateServiceUseCase;

  beforeEach(() => {
    serviceRepository = {
      findById: jest.fn().mockResolvedValue(service()),
      update: jest.fn().mockResolvedValue(service()),
    };
    const professionalRepository: jest.Mocked<
      Pick<ProfessionalRepository, 'findById'>
    > = {
      findById: jest.fn().mockResolvedValue({ id: 'p1' } as Professional),
    };
    const depositQrAssignment: jest.Mocked<
      Pick<DepositQrAssignmentValidator, 'assertAssignable'>
    > = {
      assertAssignable: jest.fn(),
    };
    const audit: jest.Mocked<Pick<AuditRecorder, 'record'>> = {
      record: jest.fn(),
    };

    useCase = new UpdateServiceUseCase(
      serviceRepository as unknown as ServiceRepository,
      professionalRepository as unknown as ProfessionalRepository,
      depositQrAssignment as unknown as DepositQrAssignmentValidator,
      audit as unknown as AuditRecorder,
    );
  });

  /* Asserting on the keys, not with `toHaveBeenCalledWith`: that one treats a property
   * set to `undefined` as absent, which is exactly the bug being guarded against. */
  const patchSentToRepository = (): Record<string, unknown> =>
    serviceRepository.update.mock.calls[0][1] as Record<string, unknown>;

  it('changes only who offers the service when that is all the patch carries', async () => {
    await useCase.execute('s1', { professionalIds: ['p1', 'p2'] });

    // A fabricated `name: undefined` would reach the database as an update of no columns.
    expect(Object.keys(patchSentToRepository())).toEqual(['professionalIds']);
    expect(patchSentToRepository().professionalIds).toEqual(['p1', 'p2']);
  });

  it('trims the name it is given', async () => {
    await useCase.execute('s1', { name: '  Limpieza facial  ' });

    expect(Object.keys(patchSentToRepository())).toEqual(['name']);
    expect(patchSentToRepository().name).toBe('Limpieza facial');
  });
});
