import { Currency } from '@domain/common/value-objects/currency.vo';
import { AppointmentBookingAnswer } from '../value-objects/appointment-booking-answer.vo';
import { Appointment, AppointmentStatus } from '../entities/appointment.entity';

export interface CreateAppointmentData {
  branchId: string;
  clientId: string;
  bookingContactClientId: string;
  professionalId: string;
  serviceId: string;
  startsAt: Date;
  endsAt: Date;
  status: AppointmentStatus;
  price: string;
  currency: Currency;
  depositAmount?: string | null;
  bookingAnswers?: AppointmentBookingAnswer[];
}

// Write side, plus the reads that feed business rules. Listings that go to a screen or
// to the agent come from AppointmentViewRepository.
export interface AppointmentRepository {
  create(data: CreateAppointmentData): Promise<Appointment>;
  save(appointment: Appointment): Promise<Appointment>;
  saveDepositConfirmation(
    appointment: Appointment,
  ): Promise<Appointment | null>;
  findById(id: string): Promise<Appointment | null>;
  findByIdForUpdate(id: string): Promise<Appointment | null>;
  findOverlapping(input: {
    professionalId: string;
    startsAt: Date;
    endsAt: Date;
    excludeAppointmentId?: string;
  }): Promise<Appointment[]>;
  findByProfessionalInRange(input: {
    professionalId: string;
    from: Date;
    to: Date;
  }): Promise<Appointment[]>;
  // Sets branch_id and price/currency/deposit snapshots from the linked service.
  backfillBranchAndPriceSnapshots(branchId: string): Promise<number>;
  deleteAllUnscoped(): Promise<void>;
}

export const APPOINTMENT_REPOSITORY = 'AppointmentRepository';
