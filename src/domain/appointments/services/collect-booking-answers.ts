import { AppointmentBookingAnswer } from '../value-objects/appointment-booking-answer.vo';
import { ServiceBookingQuestion } from '@domain/services/entities/service-booking-question.entity';
import { BookingQuestionKind } from '@domain/services/value-objects/booking-question-kind.vo';
import {
  BookingAnswerInvalidError,
  BookingAnswersIncompleteError,
  BookingQuestionNotFoundError,
} from '../exceptions/appointment.exceptions';

export interface SubmittedBookingAnswer {
  questionId: string;
  value: string;
}

const YES_NO = new Set(['yes', 'no', 'sí', 'si']);

export function collectBookingAnswers(
  questions: ServiceBookingQuestion[],
  submitted: SubmittedBookingAnswer[],
): AppointmentBookingAnswer[] {
  const active = [...questions]
    .filter((question) => question.isActive)
    .sort((a, b) => a.sortOrder - b.sortOrder);
  const byId = new Map(active.map((question) => [question.id, question]));
  const seen = new Set<string>();
  const answers: AppointmentBookingAnswer[] = [];

  for (const item of submitted) {
    const question = byId.get(item.questionId);
    if (!question) {
      throw new BookingQuestionNotFoundError(item.questionId);
    }
    if (seen.has(question.id)) continue;
    seen.add(question.id);

    const value = normalizeAnswer(question.kind, item.value);
    if (value === null) {
      throw new BookingAnswerInvalidError(question.id);
    }

    answers.push({
      questionId: question.id,
      promptSnapshot: question.prompt,
      kind: question.kind,
      value,
    });
  }

  const missing = active.filter(
    (question) => question.isRequired && !seen.has(question.id),
  );
  if (missing.length > 0) {
    throw new BookingAnswersIncompleteError();
  }

  return answers;
}

function normalizeAnswer(
  kind: BookingQuestionKind,
  raw: string,
): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  if (kind === BookingQuestionKind.YES_NO) {
    const normalized = trimmed.toLowerCase();
    if (!YES_NO.has(normalized)) return null;
    return normalized === 'no' ? 'no' : 'yes';
  }

  return trimmed;
}
