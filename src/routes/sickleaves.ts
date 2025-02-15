import express from 'express';
import { Request, Response } from 'express';
import prisma from '@/lib/db';
import { authenticateToken, authorizeRole } from '@/lib/middleware';

const router = express.Router();

router.post("/tappenz/start", authenticateToken, authorizeRole('admin'), async (req: Request, res: Response): Promise<any> => {
  let reqUser = req.user;

  if (!reqUser) return res.status(401).json({ error: 'Unauthorized' });

  let { userId = null, start = null } = req.body;

  if (!userId || !start) return res.status(400).json({ error: 'Missing fields' });

  try {
    let userInQuestion = await prisma.user.findUnique({
      where: {
        id: userId
      }
    });

    if (!userInQuestion) return res.status(404).json({ error: 'User not found' });

    let ongoingTappenz = await prisma.tappenz.findFirst({
      where: {
        userId,
        endDate: null
      }
    });

    if (ongoingTappenz) return res.status(400).json({ error: 'User already has an ongoing tappenz' });

    let tappenz = await prisma.tappenz.create({
      data: {
        userId,
        managerId: reqUser.id,
        startDate: new Date(start),
        endDate: null,
      }
    });

    res.json(tappenz);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

router.post("/tappenz/end", authenticateToken, authorizeRole('admin'), async (req: Request, res: Response): Promise<any> => {
  let reqUser = req.user;

  if (!reqUser) return res.status(401).json({ error: 'Unauthorized' });

  let { userId = null, end = null } = req.body;

  if (!userId || !end) return res.status(400).json({ error: 'Missing fields' });

  try {
    let userInQuestion = await prisma.user.findUnique({
      where: {
        id: userId
      }
    });

    if (!userInQuestion) return res.status(404).json({ error: 'User not found' });

    let tappenz = await prisma.tappenz.findFirst({
      where: {
        userId,
        endDate: null
      }
    });

    if (!tappenz) return res.status(404).json({ error: 'No ongoing tappenz found' });

    tappenz = await prisma.tappenz.update({
      where: {
        id: tappenz.id
      },
      data: {
        endDate: new Date(end)
      }
    });

    res.json(tappenz);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

router.delete("/tappenz/:id", authenticateToken, authorizeRole('admin'), async (req: Request, res: Response): Promise<any> => {
  let reqUser = req.user;

  if (!reqUser) return res.status(401).json({ error: 'Unauthorized' });

  try {
    let tappenz = await prisma.tappenz.findUnique({
      where: {
        id: req.params.id
      }
    });

    if (!tappenz) return res.status(404).json({ error: 'Tappenz not found' });

    tappenz = await prisma.tappenz.delete({
      where: {
        id: req.params.id
      }
    });

    res.json(tappenz);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

router.get("/tappenz/cumulative/:userId", authenticateToken, authorizeRole('admin'), async (req: Request, res: Response): Promise<any> => {
  let reqUser = req.user;

  if (!reqUser) return res.status(401).json({ error: 'Unauthorized' });

  try {
    let tappenz = await prisma.tappenz.findMany({
      where: {
        userId: req.params.userId
      },
      orderBy: {
        startDate: 'desc'
      }
    });

    console.log(tappenz);

    let cumulative = 0;

    for (const element of tappenz) {
      if (element.endDate == null) continue
      let diff = element.endDate.getTime() - element.startDate.getTime();
      let days = Math.ceil(diff / (1000 * 60 * 60 * 24)) + 1;
      cumulative += days;
    }

    res.json(cumulative);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

router.get("/tappenz/current/:userId", authenticateToken, authorizeRole('admin'), async (req: Request, res: Response): Promise<any> => {
  let reqUser = req.user;

  if (!reqUser) return res.status(401).json({ error: 'Unauthorized' });

  try {
    let tappenz = await prisma.tappenz.findFirst({
      where: {
        userId: req.params.userId,
      },
      orderBy: {
        startDate: 'desc'
      }
    });

    if (!tappenz) return res.status(200).json({ current: false });

    if (tappenz.endDate == null) return res.status(200).json({ current: true });

    let today = new Date().setHours(0, 0, 0, 0);
    if (tappenz.startDate.getTime() <= today && tappenz.endDate.getTime() >= today) return res.status(200).json({ current: true });

    if (tappenz.endDate.getTime() < today) return res.status(200).json({ current: false });

    res.status(200).json({ current: false });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

router.get("/tappenz/:userId", authenticateToken, authorizeRole('admin'), async (req: Request, res: Response): Promise<any> => {
  let reqUser = req.user;

  if (!reqUser) return res.status(401).json({ error: 'Unauthorized' });

  try {
    let tappenz = await prisma.tappenz.findMany({
      where: {
        userId: req.params.userId
      },
      orderBy: {
        startDate: 'desc'
      },
      take: 5
    });

    res.json(tappenz);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});



export default router;