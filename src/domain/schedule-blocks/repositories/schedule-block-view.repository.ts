import { ProfessionalSummary } from '@domain/professionals/views/professional-summary';
import { ScheduleBlock } from '../entities/schedule-block.entity';

// A block without a professional belongs to the whole business (holiday, closure), and
// then there is no summary to show.
export interface ScheduleBlockView {
  block: ScheduleBlock;
  professional: ProfessionalSummary | null;
}

export interface ScheduleBlockViewRepository {
  findInRange(input: {
    from: Date;
    to: Date;
    professionalId?: string;
  }): Promise<ScheduleBlockView[]>;
}

export const SCHEDULE_BLOCK_VIEW_REPOSITORY = 'ScheduleBlockViewRepository';
