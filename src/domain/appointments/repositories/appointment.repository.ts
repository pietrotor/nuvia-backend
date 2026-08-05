import { Appointment, AppointmentStatus } from '../entities/appointment.entity';

export interface CreateAppointmentData {
  clientId: string;
  professionalId: string;
  serviceId: string;
  startsAt: Date;
  endsAt: Date;
  status: AppointmentStatus;
}

// Write side, plus the reads that feed business rules. Listings that go to a screen or
// to the agent come from AppointmentViewRepository.
export interface AppointmentRepository {
  create(data: CreateAppointmentData): Promise<Appointment>;
  save(appointment: Appointment): Promise<Appointment>;
  findById(id: string): Promise<Appointment | null>;
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
  deleteAllUnscoped(): Promise<void>;
}

export const APPOINTMENT_REPOSITORY = 'AppointmentRepository';
