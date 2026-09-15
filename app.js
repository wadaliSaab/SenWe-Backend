import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import { rateLimiter } from './src/middleware/rateLimiter.js';
import mongoSanitizeMiddleware from './src/middleware/mongoSanitizeMiddleware.js';
import hpp from 'hpp';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import authRoutes from './src/routes/authRoutes.js';
import userRoutes from './src/routes/userRoutes.js';

import conversationRoutes from './src/routes/conversationRoutes.js';
import friendRequestRoutes from './src/routes/friendRequestRoutes.js';
import privateMessageRoutes from './src/routes/privateMessageRoutes.js';
import messageRoutes from './src/routes/messageRoutes.js';
import scheduledMessageRoutes from './src/routes/scheduledMessageRoutes.js';
import blockRoutes from './src/routes/blockRoutes.js';
import savedMessageRoutes from './src/routes/savedMessagesRoutes.js';
import errorMiddleware from './src/middleware/errorMiddleware.js';
import loggerMiddleware from './src/middleware/loggerMiddleware.js';



const app = express();
app.use(express.json());    
app.disable('x-powered-by')
app.set('trust proxy', 1)

app.use(loggerMiddleware);
app.use(helmet());
app.use(cors({
    origin:process.env.CLIENT_URL,
    credentials: true
}))

app.use(rateLimiter);
app.use(mongoSanitizeMiddleware);
app.use(hpp());
app.use(compression());
app.use(cookieParser());
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/conversations', conversationRoutes);
app.use('/api/messages', messageRoutes);
app.use('/api/friends', friendRequestRoutes);
app.use('/api/blocks', blockRoutes);
app.use('/api/private', privateMessageRoutes);
app.use('/api/saved', savedMessageRoutes);
app.use('/api/scheduled', scheduledMessageRoutes);


app.use(errorMiddleware);

export default app