import { NotificationContact } from '../entities/notification-contact.entity';

export interface NotificationContactRepository {
  create(contact: {
    displayName: string;
    phoneE164: string;
    activationCodeHash: string;
    activationExpiresAt: Date;
  }): Promise<NotificationContact>;
  save(contact: NotificationContact): Promise<NotificationContact>;
  findById(id: string): Promise<NotificationContact | null>;
  findByPhone(phoneE164: string): Promise<NotificationContact | null>;
  findByIds(ids: string[]): Promise<NotificationContact[]>;
}

export const NOTIFICATION_CONTACT_REPOSITORY = 'NotificationContactRepository';
