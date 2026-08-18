import { Currency } from '@domain/common/value-objects/currency.vo';

import {
  BusinessCategory,
  DEFAULT_BUSINESS_CATEGORY,
} from '../value-objects/business-category.vo';

export enum AgentTone {
  FORMAL = 'formal',
  WARM = 'warm',
}

export interface BookingPolicy {
  minLeadTimeHours: number;
  cancelRescheduleHours: number;
  noShowMessage: string;
}

export enum EmojiPolicy {
  NONE = 'none',
  LIGHT = 'light',
  EXPRESSIVE = 'expressive',
}

export const DEFAULT_HUMAN_ATTENTION_LABEL_NAME = 'Requiere atención humana';

export interface AgentPolicy {
  /** Minutes of staff silence after pause before inbound can auto-resume the bot. 0 = never. */
  handoffAutoResumeMinutes: number;
  emojiPolicy: EmojiPolicy;
  // Business facts the owner wants the agent to mention. Data, never instructions.
  businessNotes: string | null;
  // When on, Nuvi mirrors the handoff (bot paused) state onto a WhatsApp Business
  // label, and honours the owner adding/removing that label from her phone.
  // Opt-in per tenant: label sync on Evolution/Baileys is best-effort and must be
  // verified against a real device before turning on (see evolution-whatsapp-ops).
  humanAttentionLabelSync: boolean;
  // Owner-facing text of that label. Configurable so each business can word it.
  humanAttentionLabelName: string;
}

export const DEFAULT_AGENT_POLICY: AgentPolicy = {
  handoffAutoResumeMinutes: 60,
  emojiPolicy: EmojiPolicy.LIGHT,
  businessNotes: null,
  humanAttentionLabelSync: false,
  humanAttentionLabelName: DEFAULT_HUMAN_ATTENTION_LABEL_NAME,
};

export interface DayHours {
  start: string;
  end: string;
}

export type WeeklyHours = {
  mon: DayHours | null;
  tue: DayHours | null;
  wed: DayHours | null;
  thu: DayHours | null;
  fri: DayHours | null;
  sat: DayHours | null;
  sun: DayHours | null;
};

export interface BusinessConfigProps {
  id: string;
  tenantId: string;
  slug: string;
  agentName: string;
  tone: AgentTone;
  businessCategory?: BusinessCategory;
  currency: Currency;
  logoUrl?: string | null;
  whatsappPhone?: string | null;
  bookingPolicy: BookingPolicy;
  agentPolicy?: Partial<AgentPolicy>;
  faq: Record<string, string>;
  evolutionInstanceId?: string | null;
  evolutionInstanceName?: string | null;
  evolutionWebhookTokenHash?: string | null;
  // Provider id of the "human attention" label, resolved once the instance is
  // linked. Infra identity, like evolutionInstanceId; never set from the panel.
  evolutionHumanLabelId?: string | null;
  createdAt?: Date;
  updatedAt?: Date;
}

export class BusinessConfig {
  public readonly id: string;
  public readonly tenantId: string;
  public readonly slug: string;
  public readonly agentName: string;
  public readonly tone: AgentTone;
  // Trade the business belongs to: drives how the agent speaks and what it is allowed
  // to talk about. Assigned by support, not by the owner.
  public readonly businessCategory: BusinessCategory;
  // Currency the business charges in: every price and deposit is expressed in it
  // unless a service overrides it.
  public readonly currency: Currency;
  public readonly logoUrl: string | null;
  public readonly whatsappPhone: string | null;
  public readonly bookingPolicy: BookingPolicy;
  public readonly agentPolicy: AgentPolicy;
  public readonly faq: Record<string, string>;
  public readonly evolutionInstanceId: string | null;
  public readonly evolutionInstanceName: string | null;
  public readonly evolutionWebhookTokenHash: string | null;
  public readonly evolutionHumanLabelId: string | null;
  public readonly createdAt?: Date;
  public readonly updatedAt?: Date;

  constructor(props: BusinessConfigProps) {
    this.id = props.id;
    this.tenantId = props.tenantId;
    this.slug = props.slug;
    this.agentName = props.agentName;
    this.tone = props.tone;
    this.businessCategory = props.businessCategory ?? DEFAULT_BUSINESS_CATEGORY;
    this.currency = props.currency;
    this.logoUrl = props.logoUrl ?? null;
    this.whatsappPhone = props.whatsappPhone ?? null;
    this.bookingPolicy = props.bookingPolicy;
    // Rows written before a policy field existed only carry part of the object.
    this.agentPolicy = { ...DEFAULT_AGENT_POLICY, ...props.agentPolicy };
    this.faq = props.faq;
    this.evolutionInstanceId = props.evolutionInstanceId ?? null;
    this.evolutionInstanceName = props.evolutionInstanceName ?? null;
    this.evolutionWebhookTokenHash = props.evolutionWebhookTokenHash ?? null;
    this.evolutionHumanLabelId = props.evolutionHumanLabelId ?? null;
    this.createdAt = props.createdAt;
    this.updatedAt = props.updatedAt;
  }

  allowsChangeWithoutPenalty(startsAt: Date, now: Date): boolean {
    const hoursAhead = (startsAt.getTime() - now.getTime()) / 3_600_000;
    return hoursAhead >= this.bookingPolicy.cancelRescheduleHours;
  }

  canSendMessages(): boolean {
    return (
      this.evolutionInstanceId !== null && this.evolutionInstanceName !== null
    );
  }
}
