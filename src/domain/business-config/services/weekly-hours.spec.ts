import { WeeklyHours } from '../entities/business-config.entity';
import { intersectWeeklyHours } from './weekly-hours';

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
