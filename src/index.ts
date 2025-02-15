import express, { Express, Request, Response } from 'express';
import dotenv from 'dotenv';

import usersRoutes from './routes/users';
import requestsRoutes from './routes/requests';
import messagesRoutes from './routes/messages';
import leavesRoutes from './routes/leaves';
import tappenzRoutes from './routes/sickleaves';
import plansRoutes from './routes/plans';

dotenv.config();

const app: Express = express();
const port = process.env.PORT || 9999;

app.use(express.json());
app.use(usersRoutes);
app.use(requestsRoutes);
app.use(messagesRoutes);
app.use(leavesRoutes);
app.use(tappenzRoutes);
app.use(plansRoutes);

app.listen(port, () => {
  console.log(`[server]: Server is running at http://localhost:${port}`);
});