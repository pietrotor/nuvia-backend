import {
  createDevLatencyMiddleware,
  readDevLatencyConfig,
} from './dev-latency.middleware';

describe('readDevLatencyConfig', () => {
  it('returns null in production even when latency is set', () => {
    expect(
      readDevLatencyConfig({
        NODE_ENV: 'production',
        DEV_HTTP_LATENCY_MS: '500',
      }),
    ).toBeNull();
  });

  it('returns null when unset or zero', () => {
    expect(readDevLatencyConfig({ NODE_ENV: 'development' })).toBeNull();
    expect(
      readDevLatencyConfig({
        NODE_ENV: 'development',
        DEV_HTTP_LATENCY_MS: '0',
      }),
    ).toBeNull();
  });

  it('parses latency and optional jitter', () => {
    expect(
      readDevLatencyConfig({
        NODE_ENV: 'development',
        DEV_HTTP_LATENCY_MS: '400',
        DEV_HTTP_LATENCY_JITTER_MS: '100',
      }),
    ).toEqual({ latencyMs: 400, jitterMs: 100 });
  });
});

describe('createDevLatencyMiddleware', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('delays normal API routes', () => {
    const middleware = createDevLatencyMiddleware({
      latencyMs: 300,
      jitterMs: 0,
    });
    const next = jest.fn();

    middleware({ path: '/api/v1/appointments' } as never, {} as never, next);

    expect(next).not.toHaveBeenCalled();
    jest.advanceTimersByTime(299);
    expect(next).not.toHaveBeenCalled();
    jest.advanceTimersByTime(1);
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('skips SSE, webhooks and swagger', () => {
    const middleware = createDevLatencyMiddleware({
      latencyMs: 500,
      jitterMs: 0,
    });
    const next = jest.fn();

    for (const path of [
      '/api/v1/events',
      '/api/v1/webhooks/whatsapp',
      '/api/v1/swagger',
    ]) {
      next.mockClear();
      middleware({ path } as never, {} as never, next);
      expect(next).toHaveBeenCalledTimes(1);
    }
  });
});
