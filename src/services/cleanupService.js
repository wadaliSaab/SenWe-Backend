import { cleanupQueue } from "../queues/cleanupQueue.js";

export const addCleanupJob=async(job)=>{
    await cleanupQueue.add(job.type,job);
}