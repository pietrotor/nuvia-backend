import { Inject, Injectable } from '@nestjs/common';

import { PhoneNumberService } from '@application/common/services/phone-number.service';
import { AuditRecorder } from '@application/audit/services/audit-recorder.service';
import { sanitizeBusinessNotes } from '@domain/agent/prompt/sanitize-business-notes';
import { AuditAction } from '@domain/audit/entities/audit-log.entity';
import {
  AgentPolicy,
  BusinessConfig,
} from '@domain/business-config/entities/business-config.entity';
import { BusinessConfigNotFoundError } from '@domain/business-config/exceptions/business-config.exceptions';
import {
  BUSINESS_CONFIG_REPOSITORY,
  BusinessConfigRepository,
  UpdateBusinessConfigData,
} from '@domain/business-config/repositories/business-config.repository';
import {
  assertValidClientReminderPolicy,
  ClientReminderPolicy,
  mergeClientReminderPolicy,
} from '@domain/business-config/value-objects/client-reminder-policy.vo';
import {
  AgentPolicyDto,
  ClientReminderPolicyDto,
  UpdateBusinessConfigDto,
} from '../dto/update-business-config.dto';

@Injectable()
export class UpdateBusinessConfigUseCase {
  constructor(
    @Inject(BUSINESS_CONFIG_REPOSITORY)
    private readonly businessConfigRepository: BusinessConfigRepository,
    private readonly audit: AuditRecorder,
    private readonly phoneNumbers: PhoneNumberService,
  ) {}

  async execute(dto: UpdateBusinessConfigDto): Promise<BusinessConfig> {
    const current = await this.businessConfigRepository.findByTenant();
    if (!current) throw new BusinessConfigNotFoundError();

    const data: UpdateBusinessConfigData = {
      ...dto,
      slug: dto.slug?.trim(),
      agentName: dto.agentName?.trim(),
      countryCode: dto.countryCode
        ? this.phoneNumbers.assertCountryCode(dto.countryCode)
        : undefined,
      whatsappPhone:
        dto.whatsappPhone === undefined
          ? undefined
          : this.phoneNumbers.resolvePhoneForWrite(
              dto.whatsappPhone,
              current.whatsappPhone,
              dto.countryCode ?? current.countryCode,
            ),
      agentPolicy: dto.agentPolicy
        ? this.mergeAgentPolicy(current.agentPolicy, dto.agentPolicy)
        : undefined,
      clientReminderPolicy: dto.clientReminderPolicy
        ? this.mergeClientReminderPolicy(
            current.clientReminderPolicy,
            dto.clientReminderPolicy,
          )
        : undefined,
    };
    const updated = await this.businessConfigRepository.update(data);
    if (!updated) throw new BusinessConfigNotFoundError();

    await this.audit.record({
      action: AuditAction.BUSINESS_CONFIG_UPDATED,
      entity: 'business_config',
      entityId: updated.id,
      before: current,
      after: data,
    });

    return updated;
  }

  // The policy is a single jsonb column, so a partial patch has to be merged or it would
  // silently reset the fields the owner did not send.
  private mergeAgentPolicy(
    current: AgentPolicy,
    patch: AgentPolicyDto,
  ): AgentPolicy {
    return {
      ...current,
      ...patch,
      businessNotes:
        patch.businessNotes === undefined
          ? current.businessNotes
          : sanitizeBusinessNotes(patch.businessNotes),
    };
  }

  private mergeClientReminderPolicy(
    current: ClientReminderPolicy,
    patch: ClientReminderPolicyDto,
  ): ClientReminderPolicy {
    const merged = mergeClientReminderPolicy({ ...current, ...patch });
    assertValidClientReminderPolicy(merged);
    return merged;
  }
}
