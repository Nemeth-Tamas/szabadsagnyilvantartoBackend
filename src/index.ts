import express, { Express } from 'express';
import dotenv from 'dotenv';
import cors, { CorsOptions } from 'cors';
import cookieParser from 'cookie-parser';

import usersRoutes from './routes/users';
import requestsRoutes from './routes/requests';
import messagesRoutes from './routes/messages';
import leavesRoutes from './routes/leaves';
import tappenzRoutes from './routes/sickleaves';
import plansRoutes from './routes/plans';

dotenv.config();

const app: Express = express();
const port = parseInt(process.env.PORT || "9999", 10);

const corsOptions: CorsOptions = {
  origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
    const allowedOrigins = process.env.CORS_ORIGIN?.split(',') || [];
    if (!origin || allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      console.log(origin);
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
};

app.use(cors(corsOptions));
app.use(express.json());
app.use(cookieParser());
app.use(usersRoutes);
app.use(requestsRoutes);
app.use(messagesRoutes);
app.use(leavesRoutes);
app.use(tappenzRoutes);
app.use(plansRoutes);

app.listen(port, '0.0.0.0', () => {
  console.log(`[server]: Server is running at http://localhost:${port}`);
});