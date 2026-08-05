export function shouldAutoResumeHandoff(input: {
  botPaused: boolean;
  botPausedAt: Date | null;
  now: Date;
  handoffAutoResumeMinutes: number;
}): boolean {
  if (!input.botPaused) {
    return false;
  }
  if (input.handoffAutoResumeMinutes <= 0) {
    return false;
  }
  // Rows paused before bot_paused_at existed: treat as eligible so they are not stuck forever.
  if (input.botPausedAt === null) {
    return true;
  }

  const elapsedMs = input.now.getTime() - input.botPausedAt.getTime();
  return elapsedMs >= input.handoffAutoResumeMinutes * 60_000;
}
