import { ServiceBookingQuestion } from '@domain/services/entities/service-booking-question.entity';
import { BookingQuestionKind } from '@domain/services/value-objects/booking-question-kind.vo';
import {
  BookingAnswerInvalidError,
  BookingAnswersIncompleteError,
} from '../exceptions/appointment.exceptions';
import { collectBookingAnswers } from './collect-booking-answers';

const question = (
  overrides: Partial<ServiceBookingQuestion> & { id: string },
): ServiceBookingQuestion =>
  new ServiceBookingQuestion({
    tenantId: 't1',
    serviceId: 's1',
    prompt: '¿Zona?',
    kind: BookingQuestionKind.TEXT,
    isRequired: true,
    sortOrder: 0,
    isActive: true,
    ...overrides,
  });

describe('collectBookingAnswers', () => {
  it('snapshots required answers and ignores inactive questions', () => {
    const answers = collectBookingAnswers(
      [
        question({ id: 'q1', prompt: '¿Zona a tratar?' }),
        question({
          id: 'q2',
          prompt: 'Vieja',
          isActive: false,
          isRequired: true,
        }),
      ],
      [{ questionId: 'q1', value: '  Axilas  ' }],
    );

    expect(answers).toEqual([
      {
        questionId: 'q1',
        promptSnapshot: '¿Zona a tratar?',
        kind: BookingQuestionKind.TEXT,
        value: 'Axilas',
      },
    ]);
  });

  it('rejects a booking that skipped a required question', () => {
    expect(() => collectBookingAnswers([question({ id: 'q1' })], [])).toThrow(
      BookingAnswersIncompleteError,
    );
  });

  it('normalizes yes/no answers and rejects anything else', () => {
    const yesNo = question({
      id: 'q1',
      kind: BookingQuestionKind.YES_NO,
      prompt: '¿Es la primera vez?',
    });

    expect(
      collectBookingAnswers([yesNo], [{ questionId: 'q1', value: 'Sí' }]),
    ).toEqual([expect.objectContaining({ value: 'yes' })]);

    expect(() =>
      collectBookingAnswers([yesNo], [{ questionId: 'q1', value: 'tal vez' }]),
    ).toThrow(BookingAnswerInvalidError);
  });
});
