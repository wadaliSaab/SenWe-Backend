import IORedis from "ioredis";

const redis = new IORedis({
  host: process.env.REDIS_HOST,
  port: Number(process.env.REDIS_PORT),
  password: process.env.REDIS_PASSWORD || undefined,
  maxRetriesPerRequest: null,
  retryStrategy: (times) => {
    return Math.min(times * 1000, 5000);
  },
});

redis.on("connect", () => {
  console.log("Redis is connected");
});
redis.on("ready", () => {
  console.log("Redis is ready");
});

redis.on("error", (error) => {
  console.log(error.message);
});

export default redis;
