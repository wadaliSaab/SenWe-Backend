import { Worker } from "bullmq";
import redis from "../config/redis.js";
import {deleteFile} from "../services/storageService.js";

export const cleanupWorker = new Worker("cleanup", async (job) => {
    switch(job.data.type){
        
        case "delete-files": for(const path of job.data.paths){await deleteFile(path) } ;
            break;
        default:
            throw new Error(`Invalid job type: ${job.data.type}`);
    }
   
},{
    connection: redis,
    prefix: "senwe",
});

export default cleanupWorker;