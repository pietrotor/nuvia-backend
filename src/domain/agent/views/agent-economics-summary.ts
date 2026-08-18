export interface AgentEconomicsSummary {
  from: Date;
  to: Date;
  traces: number;
  llmCalls: number;
  promptTokensTotal: number;
  completionTokensTotal: number;
  cachedPromptTokensTotal: number;
  cacheWriteTokensTotal: number;
  costCreditsTotal: number;
  bookingTraces: number;
  costCreditsPerBooking: number | null;
}
