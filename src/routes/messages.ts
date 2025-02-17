import express from 'express';
import { Request, Response } from 'express';
import prisma from '../lib/db';
import { authenticateToken, authorizeRole } from '../lib/middleware';

const router = express.Router();

router.get("/messages", authenticateToken, authorizeRole('felhasznalo'), async (req: Request, res: Response): Promise<any> => {
  let reqUser = req.user;

  if (!reqUser) return res.status(401).json({ error: 'Unauthorized' });

  try {
    let messages = await prisma.uzenetek.findMany({
      where: {
        userId: reqUser.id
      },
      orderBy: {
        createdAt: 'desc'
      },
    });

    res.json(messages);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

router.post("/messages", authenticateToken, authorizeRole('irodavezeto'), async (req: Request, res: Response): Promise<any> => {
  let reqUser = req.user;

  if (!reqUser) return res.status(401).json({ error: 'Unauthorized' });

  try {
    let { userId = null, date = null, message = null } = req.body;

    if (!userId || !date || !message) return res.status(400).json({ error: 'Missing fields' });

    let newMessage = await prisma.uzenetek.create({
      data: {
        userId,
        date: new Date(date),
        message: message,
        sendingName: reqUser.name
      }
    });

    res.json(newMessage);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

export default router;