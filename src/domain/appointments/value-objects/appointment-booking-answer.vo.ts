import { BookingQuestionKind } from '@domain/services/value-objects/booking-question-kind.vo';

export interface AppointmentBookingAnswer {
  questionId: string | null;
  promptSnapshot: string;
  kind: BookingQuestionKind;
  value: string;
}
