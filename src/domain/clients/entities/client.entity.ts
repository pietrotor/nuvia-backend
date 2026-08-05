export interface ClientProps {
  id: string;
  tenantId: string;
  name: string;
  phoneE164: string;
  notes: string | null;
  createdAt?: Date;
  updatedAt?: Date;
}

export class Client {
  public readonly id: string;
  public readonly tenantId: string;
  public readonly name: string;
  public readonly phoneE164: string;
  public readonly notes: string | null;
  public readonly createdAt?: Date;
  public readonly updatedAt?: Date;

  constructor(props: ClientProps) {
    this.id = props.id;
    this.tenantId = props.tenantId;
    this.name = props.name;
    this.phoneE164 = props.phoneE164;
    this.notes = props.notes;
    this.createdAt = props.createdAt;
    this.updatedAt = props.updatedAt;
  }
}
