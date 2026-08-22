import { Inject, Injectable } from '@nestjs/common';

import { PhoneNumberService } from '@application/common/services/phone-number.service';
import { TenantCountryService } from '@application/common/services/tenant-country.service';

import {
  AGENT_TRACE_VIEW_REPOSITORY,
  AgentTraceViewRepository,
} from '@domain/agent/repositories/agent-trace-view.repository';
import { AgentTracedConversationListResult } from '@domain/agent/views/agent-traced-conversation-view';
import {
  TENANT_CONTEXT_PORT,
  TenantContextPort,
} from '@domain/tenants/ports/tenant-context.port';

@Injectable()
export class ListTracedConversationsUseCase {
  constructor(
    @Inject(AGENT_TRACE_VIEW_REPOSITORY)
    private readonly traces: AgentTraceViewRepository,
    @Inject(TENANT_CONTEXT_PORT)
    private readonly tenantContext: TenantContextPort,
    private readonly phoneNumbers: PhoneNumberService,
    private readonly tenantCountry: TenantCountryService,
  ) {}

  async execute(input: {
    tenantId: string;
    limit: number;
    offset: number;
    search?: string;
  }): Promise<AgentTracedConversationListResult> {
    return this.tenantContext.runWithTenant(input.tenantId, async () => {
      const country = await this.tenantCountry.getCurrentCountryCode();
      const searchTerms = input.search
        ? this.phoneNumbers.buildSearchTerms(input.search, country)
        : [];

      return this.traces.listConversations({
        limit: input.limit,
        offset: input.offset,
        search: input.search,
        searchTerms,
      });
    });
  }
}
