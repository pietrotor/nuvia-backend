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

export interface AgentPolicy {
  /** Minutes of staff silence after pause before inbound can auto-resume the bot. 0 = never. */
  handoffAutoResumeMinutes: number;
  emojiPolicy: EmojiPolicy;
  // Business facts the owner wants the agent to mention. Data, never instructions.
  businessNotes: string | null;
}

export const DEFAULT_AGENT_POLICY: AgentPolicy = {
  handoffAutoResumeMinutes: 60,
  emojiPolicy: EmojiPolicy.LIGHT,
  businessNotes: null,
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
  address?: string | null;
  logoUrl?: string | null;
  whatsappPhone?: string | null;
  businessHours: WeeklyHours;
  bookingPolicy: BookingPolicy;
  agentPolicy?: Partial<AgentPolicy>;
  faq: Record<string, string>;
  staticDepositQrUrl?: string | null;
  evolutionInstanceId?: string | null;
  evolutionInstanceName?: string | null;
  evolutionWebhookTokenHash?: string | null;
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
  public readonly address: string | null;
  public readonly logoUrl: string | null;
  public readonly whatsappPhone: string | null;
  public readonly businessHours: WeeklyHours;
  public readonly bookingPolicy: BookingPolicy;
  public readonly agentPolicy: AgentPolicy;
  public readonly faq: Record<string, string>;
  public readonly staticDepositQrUrl: string | null;
  public readonly evolutionInstanceId: string | null;
  public readonly evolutionInstanceName: string | null;
  public readonly evolutionWebhookTokenHash: string | null;
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
    this.address = props.address ?? null;
    this.logoUrl = props.logoUrl ?? null;
    this.whatsappPhone = props.whatsappPhone ?? null;
    this.businessHours = props.businessHours;
    this.bookingPolicy = props.bookingPolicy;
    // Rows written before a policy field existed only carry part of the object.
    this.agentPolicy = { ...DEFAULT_AGENT_POLICY, ...props.agentPolicy };
    this.faq = props.faq;
    this.staticDepositQrUrl = props.staticDepositQrUrl ?? null;
    this.evolutionInstanceId = props.evolutionInstanceId ?? null;
    this.evolutionInstanceName = props.evolutionInstanceName ?? null;
    this.evolutionWebhookTokenHash = props.evolutionWebhookTokenHash ?? null;
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
