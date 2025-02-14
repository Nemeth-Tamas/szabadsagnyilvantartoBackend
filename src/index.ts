import express, { Express, Request, Response } from 'express';
import dotenv from 'dotenv';
import prisma from '@/lib/db';

import usersRoutes from './routes/users';

dotenv.config();

const app: Express = express();
const port = process.env.PORT || 9999;

app.use(express.json());
app.use(usersRoutes);

app.get("/", (req: Request, res: Response) => {
  res.send("Express + TypeScript Server");
});

app.listen(port, () => {
  console.log(`[server]: Server is running at http://localhost:${port}`);
});