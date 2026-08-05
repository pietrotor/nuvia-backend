import { ScheduleBlock } from '../entities/schedule-block.entity';

export interface CreateScheduleBlockData {
  professionalId?: string | null;
  startsAt: Date;
  endsAt: Date;
  reason?: string | null;
}

export interface UpdateScheduleBlockData {
  professionalId?: string | null;
  startsAt?: Date;
  endsAt?: Date;
  reason?: string | null;
  isActive?: boolean;
}

export interface ScheduleBlockRepository {
  create(data: CreateScheduleBlockData): Promise<ScheduleBlock>;
  findById(id: string): Promise<ScheduleBlock | null>;
  findOverlapping(input: {
    professionalId: string | null;
    startsAt: Date;
    endsAt: Date;
  }): Promise<ScheduleBlock[]>;
  findInRange(
    from: Date,
    to: Date,
    professionalId?: string,
  ): Promise<ScheduleBlock[]>;
  update(
    id: string,
    data: UpdateScheduleBlockData,
  ): Promise<ScheduleBlock | null>;
  deleteAllUnscoped(): Promise<void>;
}

export const SCHEDULE_BLOCK_REPOSITORY = 'ScheduleBlockRepository';
