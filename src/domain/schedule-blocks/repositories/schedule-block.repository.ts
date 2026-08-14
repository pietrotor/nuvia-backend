import { ScheduleBlock } from '../entities/schedule-block.entity';

export interface CreateScheduleBlockData {
  branchId?: string | null;
  professionalId?: string | null;
  startsAt: Date;
  endsAt: Date;
  reason?: string | null;
}

export interface UpdateScheduleBlockData {
  branchId?: string | null;
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
    branchId?: string;
  }): Promise<ScheduleBlock[]>;
  findInRange(input: {
    from: Date;
    to: Date;
    professionalId?: string;
    branchId?: string;
  }): Promise<ScheduleBlock[]>;
  update(
    id: string,
    data: UpdateScheduleBlockData,
  ): Promise<ScheduleBlock | null>;
  assignBranchToAllWithoutBranch(branchId: string): Promise<number>;
  deleteAllUnscoped(): Promise<void>;
}

export const SCHEDULE_BLOCK_REPOSITORY = 'ScheduleBlockRepository';
