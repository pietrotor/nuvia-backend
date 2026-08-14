import {
  ValidationArguments,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator';

export const MAX_LIST_DATE_RANGE_DAYS = 92;

export const MAX_DATE_RANGE_DAYS_MESSAGE =
  'El rango de fechas no puede superar 92 días.';

@ValidatorConstraint({ name: 'MaxDateRangeDays', async: false })
export class MaxDateRangeDaysConstraint
  implements ValidatorConstraintInterface
{
  validate(_: unknown, args: ValidationArguments): boolean {
    const obj = args.object as { from?: string; to?: string };
    if (!obj.from || !obj.to) return true;

    const from = new Date(obj.from);
    const to = new Date(obj.to);
    if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) {
      return true;
    }

    const diffDays = (to.getTime() - from.getTime()) / (1000 * 60 * 60 * 24);
    return diffDays <= MAX_LIST_DATE_RANGE_DAYS;
  }

  defaultMessage(): string {
    return MAX_DATE_RANGE_DAYS_MESSAGE;
  }
}
