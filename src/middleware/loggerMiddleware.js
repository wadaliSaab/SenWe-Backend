import PinoHttp from "pino-http";
import logger from "../utils/logger.js";

const loggerMiddleware = PinoHttp({ logger });
export default loggerMiddleware;