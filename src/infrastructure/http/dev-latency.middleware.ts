import type { NextFunction, Request, Response } from 'express';

/**
 * Artificial request delay for local UX work (loading states under slow networks).
 * Never enabled in production. Skips long-lived and time-sensitive paths.
 */
export function createDevLatencyMiddleware(options: {
  latencyMs: number;
  jitterMs: number;
}): (req: Request, res: Response, next: NextFunction) => void {
  const { latencyMs, jitterMs } = options;

  return (req, _res, next) => {
    if (shouldSkipLatency(req.path)) {
      next();
      return;
    }

    const delay =
      latencyMs +
      (jitterMs > 0 ? Math.floor(Math.random() * (jitterMs + 1)) : 0);

    setTimeout(next, delay);
  };
}

export function readDevLatencyConfig(env: NodeJS.ProcessEnv = process.env): {
  latencyMs: number;
  jitterMs: number;
} | null {
  if (env.NODE_ENV === 'production') {
    return null;
  }

  const latencyMs = parseNonNegativeInt(env.DEV_HTTP_LATENCY_MS);
  if (latencyMs === null || latencyMs === 0) {
    return null;
  }

  const jitterMs = parseNonNegativeInt(env.DEV_HTTP_LATENCY_JITTER_MS) ?? 0;
  return { latencyMs, jitterMs };
}

function shouldSkipLatency(path: string): boolean {
  // Global prefix is /api/v1; Express sees the full path here.
  return (
    path.startsWith('/api/v1/events') ||
    path.startsWith('/api/v1/webhooks') ||
    path.startsWith('/api/v1/swagger')
  );
}

function parseNonNegativeInt(raw: string | undefined): number | null {
  if (raw === undefined || raw.trim() === '') {
    return null;
  }
  const value = Number(raw);
  if (!Number.isFinite(value) || value < 0 || !Number.isInteger(value)) {
    return null;
  }
  return value;
}
