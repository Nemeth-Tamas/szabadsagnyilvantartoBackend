import express, { Express, Request, Response } from 'express';
import dotenv from 'dotenv';

import usersRoutes from './routes/users';
import requestsRoutes from './routes/requests';
import messagesRoutes from './routes/messages';
import leavesRoutes from './routes/leaves';

dotenv.config();

const app: Express = express();
const port = process.env.PORT || 9999;

app.use(express.json());
app.use(usersRoutes);
app.use(requestsRoutes);
app.use(messagesRoutes);
app.use(leavesRoutes);

// app.get("/", (req: Request, res: Response) => {
//   res.send("Express + TypeScript Server");
// });

app.listen(port, () => {
  console.log(`[server]: Server is running at http://localhost:${port}`);
});