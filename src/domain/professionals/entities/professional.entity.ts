export interface ProfessionalProps {
  id: string;
  tenantId: string;
  name: string;
  isActive: boolean;
  avatarStorageKey?: string | null;
  avatarMimeType?: string | null;
  createdAt?: Date;
  updatedAt?: Date;
}

export class Professional {
  public readonly id: string;
  public readonly tenantId: string;
  public readonly name: string;
  public readonly isActive: boolean;
  public readonly avatarStorageKey: string | null;
  public readonly avatarMimeType: string | null;
  public readonly createdAt?: Date;
  public readonly updatedAt?: Date;

  constructor(props: ProfessionalProps) {
    this.id = props.id;
    this.tenantId = props.tenantId;
    this.name = props.name;
    this.isActive = props.isActive;
    this.avatarStorageKey = props.avatarStorageKey ?? null;
    this.avatarMimeType = props.avatarMimeType ?? null;
    this.createdAt = props.createdAt;
    this.updatedAt = props.updatedAt;
  }

  withAvatar(storageKey: string, mimeType: string): Professional {
    return new Professional({
      ...this,
      avatarStorageKey: storageKey,
      avatarMimeType: mimeType,
    });
  }

  withoutAvatar(): Professional {
    return new Professional({
      ...this,
      avatarStorageKey: null,
      avatarMimeType: null,
    });
  }
}
