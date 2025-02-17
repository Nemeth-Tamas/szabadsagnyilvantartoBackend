import express, { Express } from 'express';
import dotenv from 'dotenv';
import cors from 'cors';
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

const corsOptions = {
  origin: process.env.CORS_ORIGIN, // Update to match your frontend's origin
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