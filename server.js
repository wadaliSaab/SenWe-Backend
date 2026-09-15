import "dotenv/config"
import logger from "./src/utils/logger.js"
import "./src/config/redis.js"
import "./src/workers/messageWorker.js"
import app from './app.js'
import {messageQueue} from './src/queues/messageQueue.js'


import http from 'http'
import connectDB from './src/config/db.js'
import { initSocket } from './src/socket/socket.js'

const PORT = process.env.PORT


process.on("uncaughtException", (error) => {
        logger.fatal(error,"Uncaught Exception");
        process.exit(1);
    });

process.on("unhandledRejection", (error) => {
    logger.fatal(error,"Unhandled Rejection");
    process.exit(1);
})

connectDB()

const server = http.createServer(app)
initSocket(server)
server.listen(PORT, () => {
    logger.info(`Server running on port ${PORT}`)
})