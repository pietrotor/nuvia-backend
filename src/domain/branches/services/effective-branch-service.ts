import { Money } from '@domain/common/value-objects/money.vo';
import { calculateDepositAmount } from '@domain/deposits/services/deposit-amount';
import { Service } from '@domain/services/entities/service.entity';

import { BranchService } from '../entities/branch-service.entity';

export interface EffectiveBranchService {
  service: Service;
  branchService: BranchService;
  price: Money;
  depositAmount: Money | null;
  depositQrId: string | null;
}

// Catalog price/deposit/QR can be overridden per branch. Percent deposits follow the
// effective price so a branch discount does not leave the seña at the catalog amount.
export function resolveEffectiveBranchService(
  service: Service,
  branchService: BranchService,
): EffectiveBranchService {
  const price = branchService.priceOverrideAmount
    ? Money.of(branchService.priceOverrideAmount, service.currency)
    : service.price;

  const depositAmount = branchService.depositAmountOverrideAmount
    ? Money.of(branchService.depositAmountOverrideAmount, service.currency)
    : calculateDepositAmount(service, { price });

  return {
    service,
    branchService,
    price,
    depositAmount,
    depositQrId: branchService.depositQrId ?? service.depositQrId,
  };
}
