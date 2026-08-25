import { Inject, Injectable, Logger } from '@nestjs/common';

import { ListClientAppointmentsUseCase } from '@application/appointments/use-cases/list-client-appointments.use-case';
import { ListBranchProfessionalsUseCase } from '@application/branches/use-cases/list-branch-professionals.use-case';
import { ListBranchServicesUseCase } from '@application/branches/use-cases/list-branch-services.use-case';
import { ListBranchesUseCase } from '@application/branches/use-cases/list-branches.use-case';
import { ListProfessionalsUseCase } from '@application/professionals/use-cases/list-professionals.use-case';
import { ListServicesUseCase } from '@application/services/use-cases/list-services.use-case';
import { sanitizeBusinessNotes } from '@domain/agent/prompt/sanitize-business-notes';
import { promptClientName } from '@domain/agent/prompt/client-name';
import { renderCalendar } from '@domain/agent/prompt/calendar-state';
import { renderCatalog } from '@domain/agent/prompt/catalog-state';
import {
  ClientStateAppointment,
  renderClientState,
} from '@domain/agent/prompt/client-state';
import {
  PromptChannel,
  PromptLayer,
} from '@domain/agent/prompt/prompt-fragment';
import {
  buildSystemPrompt,
  ComposedSystemPrompt,
} from '@domain/agent/prompt/system-prompt.builder';
import { TenantVoice } from '@domain/agent/prompt/tenant-voice';
import {
  PROMPT_CATALOG_PORT,
  PromptCatalogPort,
} from '@domain/agent/ports/prompt-catalog.port';
import { AppointmentStatus } from '@domain/appointments/entities/appointment.entity';
import { AppointmentView } from '@domain/appointments/repositories/appointment-view.repository';
import { Branch } from '@domain/branches/entities/branch.entity';
import {
  CLIENT_REPOSITORY,
  ClientRepository,
} from '@domain/clients/repositories/client.repository';
import { resolveEffectiveBranchService } from '@domain/branches/services/effective-branch-service';
import { BusinessConfig } from '@domain/business-config/entities/business-config.entity';
import {
  categoryLexicon,
  DEFAULT_BUSINESS_CATEGORY,
} from '@domain/business-config/value-objects/business-category.vo';
import {
  describeWorkingDayNames,
  intersectWeeklyHours,
} from '@domain/business-config/services/weekly-hours';

export interface ComposePromptInput {
  config: BusinessConfig;
  timezone: string;
  channel: PromptChannel;
  now: Date;
  clientId: string;
  branchId?: string | null;
}

const PROMPT_LOCALE = 'es';

// 24h on purpose: "03:00 p. m." is one more thing the model can read wrong.
const NOW_FORMAT: Intl.DateTimeFormatOptions = {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
};

// No year: the agent only ever states upcoming appointments to the client.
const APPOINTMENT_FORMAT: Intl.DateTimeFormatOptions = {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
};

@Injectable()
export class AgentPromptComposer {
  private readonly logger = new Logger(AgentPromptComposer.name);

  constructor(
    @Inject(PROMPT_CATALOG_PORT)
    private readonly catalog: PromptCatalogPort,
    @Inject(CLIENT_REPOSITORY)
    private readonly clients: ClientRepository,
    private readonly listClientAppointments: ListClientAppointmentsUseCase,
    private readonly listBranches: ListBranchesUseCase,
    private readonly listBranchServices: ListBranchServicesUseCase,
    private readonly listBranchProfessionals: ListBranchProfessionalsUseCase,
    private readonly listServices: ListServicesUseCase,
    private readonly listProfessionals: ListProfessionalsUseCase,
  ) {}

  async compose(input: ComposePromptInput): Promise<ComposedSystemPrompt> {
    const category = input.config.businessCategory ?? DEFAULT_BUSINESS_CATEGORY;
    const voice = this.voiceOf(input.config);
    const set = await this.catalog.findFor({
      category,
      locale: PROMPT_LOCALE,
      channel: input.channel,
      tone: voice.tone,
      emojiPolicy: voice.emojiPolicy,
    });

    if (
      !set.fragments.some((fragment) => fragment.layer === PromptLayer.CATEGORY)
    ) {
      this.logger.warn(
        `No category prompt fragments for "${category}": answering with the platform layer only`,
      );
    }

    const [businessCatalog, clientState, identity] = await Promise.all([
      this.composeCatalog(input),
      this.composeClientState(input),
      this.composeClientIdentity(input.clientId),
    ]);

    return buildSystemPrompt({
      revision: set.revision,
      fragments: set.fragments,
      category,
      lexicon: categoryLexicon(category),
      voice,
      nowLabel: this.formatNow(input.now, input.timezone),
      timezone: input.timezone,
      calendar: renderCalendar(input.now, input.timezone),
      businessCatalog,
      clientState,
      clientName: identity.clientName,
      clientNamePending: identity.clientNamePending,
    });
  }

  // Tool results do not survive the round that produced them, so the identifiers the model
  // read from list_services two messages ago are gone by the time it books. Restating them
  // every turn is what keeps it from inventing one that no repository can resolve.
  private async composeCatalog(input: ComposePromptInput): Promise<string> {
    const activeBranches = await this.listBranches.execute(true);

    if (input.branchId) {
      const branch =
        activeBranches.find((row) => row.id === input.branchId) ?? null;
      if (!branch) {
        return this.renderBusinessCatalog(activeBranches);
      }
      return this.renderBranchCatalog(branch, activeBranches);
    }

    return this.renderBusinessCatalog(activeBranches);
  }

  // Full catalog across every active branch so the agent can talk about services before
  // the client picks a location.
  private async renderBusinessCatalog(branches: Branch[]): Promise<string> {
    if (branches.length === 0) return '';

    if (branches.length === 1) {
      return this.renderBranchCatalog(branches[0], branches, {
        singleBranch: true,
      });
    }

    const [allServices, allProfessionals, offersByBranch, assignmentsByBranch] =
      await Promise.all([
        this.listServices.execute(),
        this.listProfessionals.execute(),
        Promise.all(
          branches.map(async (branch) => ({
            branch,
            offers: await this.listBranchServices.execute(branch.id, true),
          })),
        ),
        Promise.all(
          branches.map(async (branch) => ({
            branch,
            assignments: await this.listBranchProfessionals.execute(
              branch.id,
              true,
            ),
          })),
        ),
      ]);

    const professionalById = new Map(
      allProfessionals.map((professional) => [professional.id, professional]),
    );
    const serviceById = new Map(
      allServices.map((service) => [service.id, service]),
    );

    const professionals = new Map<
      string,
      {
        id: string;
        name: string;
        workingDays: string[];
        branchNames: string[];
      }
    >();
    for (const { branch, assignments } of assignmentsByBranch) {
      for (const assignment of assignments) {
        const professional = professionalById.get(assignment.professionalId);
        if (!professional || !professional.isActive) continue;
        const days = describeWorkingDayNames(
          intersectWeeklyHours(branch.weeklyHours, assignment.weeklyHours),
        );
        const existing = professionals.get(professional.id);
        if (existing) {
          if (!existing.branchNames.includes(branch.name)) {
            existing.branchNames.push(branch.name);
          }
          for (const day of days) {
            if (!existing.workingDays.includes(day)) {
              existing.workingDays.push(day);
            }
          }
        } else {
          professionals.set(professional.id, {
            id: professional.id,
            name: professional.name,
            workingDays: days,
            branchNames: [branch.name],
          });
        }
      }
    }

    const nameById = new Map(
      [...professionals.values()].map(({ id, name }) => [id, name]),
    );

    const services = new Map<
      string,
      {
        id: string;
        name: string;
        durationMinutes: number;
        professionalNames: string[];
        clientChoosesProfessional: boolean;
        branchNames: string[];
        keywords: string[];
        bookingQuestions: string[];
      }
    >();
    for (const { branch, offers } of offersByBranch) {
      for (const offer of offers) {
        const service = serviceById.get(offer.serviceId);
        if (!service || !service.isActive) continue;
        const existing = services.get(service.id);
        if (existing) {
          if (!existing.branchNames.includes(branch.name)) {
            existing.branchNames.push(branch.name);
          }
        } else {
          services.set(service.id, {
            id: service.id,
            name: service.name,
            durationMinutes: service.durationMinutes,
            professionalNames: service.professionalIds
              .map((id) => nameById.get(id))
              .filter((name): name is string => name !== undefined),
            clientChoosesProfessional: service.clientChoosesProfessional,
            branchNames: [branch.name],
            keywords: service.keywords ?? [],
            bookingQuestions: service
              .activeBookingQuestions()
              .map((question) => question.prompt),
          });
        }
      }
    }

    return renderCatalog({
      branches: branches.map((branch) => ({
        id: branch.id,
        name: branch.name,
        address: branch.address,
      })),
      professionals: [...professionals.values()],
      services: [...services.values()],
    });
  }

  private async renderBranchCatalog(
    branch: Branch,
    allBranches: Branch[],
    options: { singleBranch?: boolean } = {},
  ): Promise<string> {
    const [offers, assignments, services, professionals] = await Promise.all([
      this.listBranchServices.execute(branch.id, true),
      this.listBranchProfessionals.execute(branch.id, true),
      this.listServices.execute(),
      this.listProfessionals.execute(),
    ]);

    const serviceById = new Map(
      services.map((service) => [service.id, service]),
    );
    const professionalById = new Map(
      professionals.map((professional) => [professional.id, professional]),
    );

    const activeProfessionals = assignments
      .map((assignment) => {
        const professional = professionalById.get(assignment.professionalId);
        if (!professional || !professional.isActive) return null;
        return {
          id: professional.id,
          name: professional.name,
          workingDays: describeWorkingDayNames(
            intersectWeeklyHours(branch.weeklyHours, assignment.weeklyHours),
          ),
        };
      })
      .filter((row): row is NonNullable<typeof row> => row !== null);

    const nameById = new Map(
      activeProfessionals.map(({ id, name }) => [id, name]),
    );

    const catalogServices = offers
      .map((offer) => {
        const service = serviceById.get(offer.serviceId);
        if (!service || !service.isActive) return null;
        const effective = resolveEffectiveBranchService(service, offer);
        return {
          id: service.id,
          name: service.name,
          durationMinutes: service.durationMinutes,
          price: effective.price.display(),
          professionalNames: service.professionalIds
            .map((id) => nameById.get(id))
            .filter((name): name is string => name !== undefined),
          clientChoosesProfessional: service.clientChoosesProfessional,
          keywords: service.keywords ?? [],
          bookingQuestions: service
            .activeBookingQuestions()
            .map((question) => question.prompt),
        };
      })
      .filter((row): row is NonNullable<typeof row> => row !== null);

    return renderCatalog({
      branches: allBranches.map((row) => ({
        id: row.id,
        name: row.name,
        address: row.address,
      })),
      singleBranch: options.singleBranch === true || allBranches.length === 1,
      branch:
        options.singleBranch || allBranches.length === 1
          ? undefined
          : { name: branch.name, address: branch.address },
      professionals: activeProfessionals,
      services: catalogServices,
    });
  }
  // Read straight from the schedule on every turn: this is what stops the agent from
  // ratifying a booking it only ever claimed in a previous message.
  private async composeClientState(input: ComposePromptInput): Promise<string> {
    const appointments = await this.listClientAppointments.execute({
      clientId: input.clientId,
      onlyUpcoming: true,
      scope: 'managed',
    });

    return renderClientState(
      appointments.map((view) => this.toClientState(view, input.timezone)),
    );
  }

  private async composeClientIdentity(clientId: string): Promise<{
    clientName: string;
    clientNamePending: string;
  }> {
    const client = await this.clients.findById(clientId);
    const clientName = promptClientName(client?.name);
    return {
      clientName,
      clientNamePending: clientName ? '' : 'pendiente',
    };
  }

  private toClientState(
    view: AppointmentView,
    timezone: string,
  ): ClientStateAppointment {
    return {
      appointmentId: view.appointment.id,
      service: view.service.name,
      professional: view.professional.name,
      whenLabel: this.formatDateTime(
        view.appointment.startsAt,
        timezone,
        APPOINTMENT_FORMAT,
      ),
      awaitingDeposit:
        view.appointment.status === AppointmentStatus.PENDING_DEPOSIT,
      attendeeName:
        view.appointment.clientId === view.appointment.bookingContactClientId
          ? null
          : view.client.name,
    };
  }

  private voiceOf(config: BusinessConfig): TenantVoice {
    return {
      agentName: config.agentName,
      tone: config.tone,
      emojiPolicy: config.agentPolicy.emojiPolicy,
      businessNotes: sanitizeBusinessNotes(config.agentPolicy.businessNotes),
    };
  }

  // No seconds: the volatile block stays identical within the same minute.
  private formatNow(now: Date, timezone: string): string {
    return this.formatDateTime(now, timezone, NOW_FORMAT);
  }

  private formatDateTime(
    date: Date,
    timezone: string,
    format: Intl.DateTimeFormatOptions,
  ): string {
    try {
      return new Intl.DateTimeFormat('es-BO', {
        ...format,
        timeZone: timezone,
      }).format(date);
    } catch {
      this.logger.warn(
        `Unusable tenant timezone "${timezone}": dating the prompt in UTC`,
      );
      return new Intl.DateTimeFormat('es-BO', {
        ...format,
        timeZone: 'UTC',
      }).format(date);
    }
  }
}
