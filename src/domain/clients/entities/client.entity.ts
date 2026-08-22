import { hasConfirmedClientName } from '../services/confirmed-client-name';

export interface ClientProps {
  id: string;
  tenantId: string;
  name: string | null;
  phoneE164: string | null;
  whatsappProfileName?: string | null;
  email?: string | null;
  birthDate?: string | null;
  identificationType?: string | null;
  identificationNumber?: string | null;
  address?: string | null;
  notes: string | null;
  createdAt?: Date;
  updatedAt?: Date;
}

export class Client {
  public readonly id: string;
  public readonly tenantId: string;
  public readonly name: string | null;
  public readonly phoneE164: string | null;
  public readonly whatsappProfileName: string | null;
  public readonly email: string | null;
  public readonly birthDate: string | null;
  public readonly identificationType: string | null;
  public readonly identificationNumber: string | null;
  public readonly address: string | null;
  public readonly notes: string | null;
  public readonly createdAt?: Date;
  public readonly updatedAt?: Date;

  constructor(props: ClientProps) {
    this.id = props.id;
    this.tenantId = props.tenantId;
    this.name = props.name;
    this.phoneE164 = props.phoneE164;
    this.whatsappProfileName = props.whatsappProfileName ?? null;
    this.email = props.email ?? null;
    this.birthDate = props.birthDate ?? null;
    this.identificationType = props.identificationType ?? null;
    this.identificationNumber = props.identificationNumber ?? null;
    this.address = props.address ?? null;
    this.notes = props.notes;
    this.createdAt = props.createdAt;
    this.updatedAt = props.updatedAt;
  }

  hasConfirmedName(): boolean {
    return hasConfirmedClientName(this.name);
  }

  withName(name: string): Client {
    return new Client({ ...this, name });
  }
}
