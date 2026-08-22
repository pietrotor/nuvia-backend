import { BookingQuestionKind } from '../value-objects/booking-question-kind.vo';

export interface ServiceBookingQuestionProps {
  id: string;
  tenantId: string;
  serviceId: string;
  prompt: string;
  kind: BookingQuestionKind;
  isRequired: boolean;
  sortOrder: number;
  isActive: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

export class ServiceBookingQuestion {
  public readonly id: string;
  public readonly tenantId: string;
  public readonly serviceId: string;
  public readonly prompt: string;
  public readonly kind: BookingQuestionKind;
  public readonly isRequired: boolean;
  public readonly sortOrder: number;
  public readonly isActive: boolean;
  public readonly createdAt?: Date;
  public readonly updatedAt?: Date;

  constructor(props: ServiceBookingQuestionProps) {
    this.id = props.id;
    this.tenantId = props.tenantId;
    this.serviceId = props.serviceId;
    this.prompt = props.prompt;
    this.kind = props.kind;
    this.isRequired = props.isRequired;
    this.sortOrder = props.sortOrder;
    this.isActive = props.isActive;
    this.createdAt = props.createdAt;
    this.updatedAt = props.updatedAt;
  }
}
