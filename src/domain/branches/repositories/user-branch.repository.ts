export interface UserBranchRepository {
  // Replaces the full set: a staff member either has access to a branch or does not.
  setForUser(userId: string, branchIds: string[]): Promise<void>;
  findBranchIdsByUser(userId: string): Promise<string[]>;
  deleteAllUnscoped(): Promise<void>;
}

export const USER_BRANCH_REPOSITORY = 'UserBranchRepository';
