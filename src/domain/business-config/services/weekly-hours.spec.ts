import { WeeklyHours } from '../entities/business-config.entity';
import { describeWorkingDays, intersectWeeklyHours } from './weekly-hours';

const closedWeek = (): WeeklyHours => ({
  mon: null,
  tue: null,
  wed: null,
  thu: null,
  fri: null,
  sat: null,
  sun: null,
});

describe('intersectWeeklyHours', () => {
  it('keeps only the span shared by business and professional', () => {
    const business = closedWeek();
    business.mon = { start: '09:00', end: '18:00' };
    const professional = closedWeek();
    professional.mon = { start: '08:00', end: '12:00' };

    expect(intersectWeeklyHours(business, professional).mon).toEqual({
      start: '09:00',
      end: '12:00',
    });
  });

  it('closes the day when the hours do not overlap', () => {
    const business = closedWeek();
    business.mon = { start: '09:00', end: '12:00' };
    const professional = closedWeek();
    professional.mon = { start: '13:00', end: '18:00' };

    expect(intersectWeeklyHours(business, professional).mon).toBeNull();
  });
});

describe('describeWorkingDays', () => {
  it('names the open days in the order of the week', () => {
    const hours = closedWeek();
    hours.sat = { start: '09:00', end: '14:00' };
    hours.mon = { start: '09:00', end: '18:00' };

    expect(describeWorkingDays(hours)).toEqual([
      'lunes 09:00 a 18:00',
      'sábado 09:00 a 14:00',
    ]);
  });

  it('leaves out the days that are closed', () => {
    expect(describeWorkingDays(closedWeek())).toEqual([]);
  });
});
