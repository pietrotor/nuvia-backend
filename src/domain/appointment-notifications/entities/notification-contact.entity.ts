import { NotificationContactStatus } from '../value-objects/notification-contact-status.vo';

export interface NotificationContactProps {
  id: string;
  tenantId: string;
  displayName: string;
  phoneE164: string;
  status: NotificationContactStatus;
  activationCodeHash: string | null;
  activationExpiresAt: Date | null;
  activationProviderMessageId: string | null;
  activatedAt: Date | null;
  pausedAt: Date | null;
  deactivatedAt: Date | null;
  lastInboundAt: Date | null;
  createdAt?: Date;
  updatedAt?: Date;
}

export class NotificationContact {
  public readonly id: string;
  public readonly tenantId: string;
  public readonly displayName: string;
  public readonly phoneE164: string;
  public readonly status: NotificationContactStatus;
  public readonly activationCodeHash: string | null;
  public readonly activationExpiresAt: Date | null;
  public readonly activationProviderMessageId: string | null;
  public readonly activatedAt: Date | null;
  public readonly pausedAt: Date | null;
  public readonly deactivatedAt: Date | null;
  public readonly lastInboundAt: Date | null;
  public readonly createdAt?: Date;
  public readonly updatedAt?: Date;

  constructor(props: NotificationContactProps) {
    this.id = props.id;
    this.tenantId = props.tenantId;
    this.displayName = props.displayName;
    this.phoneE164 = props.phoneE164;
    this.status = props.status;
    this.activationCodeHash = props.activationCodeHash;
    this.activationExpiresAt = props.activationExpiresAt;
    this.activationProviderMessageId = props.activationProviderMessageId;
    this.activatedAt = props.activatedAt;
    this.pausedAt = props.pausedAt;
    this.deactivatedAt = props.deactivatedAt;
    this.lastInboundAt = props.lastInboundAt;
    this.createdAt = props.createdAt;
    this.updatedAt = props.updatedAt;
  }

  canReceiveAlerts(): boolean {
    return this.status === NotificationContactStatus.ACTIVE;
  }

  maskedPhone(): string {
    const digits = this.phoneE164.replace(/\D/g, '');
    if (digits.length < 7) return this.phoneE164;
    return `+${digits.slice(0, 4)}****${digits.slice(-3)}`;
  }

  withDisplayName(displayName: string): NotificationContact {
    return new NotificationContact({ ...this, displayName });
  }

  withFreshActivation(input: {
    activationCodeHash: string;
    activationExpiresAt: Date;
  }): NotificationContact {
    return new NotificationContact({
      ...this,
      status: NotificationContactStatus.PENDING,
      activationCodeHash: input.activationCodeHash,
      activationExpiresAt: input.activationExpiresAt,
      activationProviderMessageId: null,
      activatedAt: null,
      pausedAt: null,
      deactivatedAt: null,
    });
  }

  activate(input: {
    now: Date;
    providerMessageId: string;
  }): NotificationContact {
    return new NotificationContact({
      ...this,
      status: NotificationContactStatus.ACTIVE,
      activationCodeHash: null,
      activationExpiresAt: null,
      activationProviderMessageId: input.providerMessageId,
      activatedAt: input.now,
      pausedAt: null,
      deactivatedAt: null,
      lastInboundAt: input.now,
    });
  }

  pause(now: Date): NotificationContact {
    if (this.status !== NotificationContactStatus.ACTIVE) return this;
    return new NotificationContact({
      ...this,
      status: NotificationContactStatus.PAUSED,
      pausedAt: now,
      lastInboundAt: now,
    });
  }

  resume(now: Date): NotificationContact {
    if (this.status !== NotificationContactStatus.PAUSED) return this;
    return new NotificationContact({
      ...this,
      status: NotificationContactStatus.ACTIVE,
      pausedAt: null,
      lastInboundAt: now,
    });
  }

  deactivate(now: Date): NotificationContact {
    if (this.status === NotificationContactStatus.DEACTIVATED) return this;
    return new NotificationContact({
      ...this,
      status: NotificationContactStatus.DEACTIVATED,
      activationCodeHash: null,
      activationExpiresAt: null,
      pausedAt: null,
      deactivatedAt: now,
      lastInboundAt: now,
    });
  }

  touchInbound(now: Date): NotificationContact {
    return new NotificationContact({ ...this, lastInboundAt: now });
  }
}
