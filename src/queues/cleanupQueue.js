import { Queue } from "bullmq";
import redis from "../config/redis.js";

export const cleanupQueue = new Queue("cleanup", {
    connection: redis,
    prefix: "senwe",
    defaultJobOptions: { removeOnComplete: 100, removeOnFail: 500 ,attempts:3,
    backoff: {type: "exponential", delay: 1000},
    stackTraceLimit:5
     },
});