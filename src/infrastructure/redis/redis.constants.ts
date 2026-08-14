// Two dedicated connections per process: an ioredis client that subscribes enters subscriber mode and
// can no longer publish. What must never happen is one connection per client of a stream — that is what
// exhausts `maxclients` and makes pub/sub collapse under load.
export const REDIS_PUBLISHER = 'RedisPublisher';
export const REDIS_SUBSCRIBER = 'RedisSubscriber';
