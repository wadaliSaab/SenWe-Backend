import dns from "node:dns";

dns.setServers(["1.1.1.1", "8.8.8.8"]);
import mongoose from "mongoose";
import logger from "../utils/logger.js";

const connectDB = async () => {
    try {
       await mongoose.connect(process.env.MONGO_URI);
        logger.info("Database connected");
    } catch (error) {
        console.error(error);
        logger.info("Database connection failed");  
        logger.fatal(error.message);
        process.exit(1);
    }
};

export default connectDB;