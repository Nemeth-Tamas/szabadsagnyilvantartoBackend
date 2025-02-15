import express from 'express';
import { Request, Response } from 'express';
import prisma from '@/lib/db';
import { authenticateToken, authorizeRole } from '@/lib/middleware';

const router = express.Router();

router.get("/leaves/own", authenticateToken, authorizeRole('felhasznalo'), async (req: Request, res: Response): Promise<any> => {
  let reqUser = req.user;

  if (!reqUser) return res.status(401).json({ error: 'Unauthorized' });

  try {
    let leaves = await prisma.szabadsag.findMany({
      where: {
        userId: reqUser.id
      },
      orderBy: {
        createdAt: 'desc'
      },
    });

    res.json(leaves);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

router.get("/leaves/:userId", authenticateToken, authorizeRole('irodavezeto'), async (req: Request, res: Response): Promise<any> => {
  let reqUser = req.user;

  if (!reqUser) return res.status(401).json({ error: 'Unauthorized' });

  try {
    let leaves = await prisma.szabadsag.findMany({
      where: {
        userId: req.params.userId
      },
      orderBy: {
        createdAt: 'desc'
      },
    });

    res.json(leaves);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

export default router;