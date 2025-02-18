import express from 'express';
import { Request, Response } from 'express';
import prisma from '../lib/db';
import { authenticateToken, authorizeRole } from '../lib/middleware';
import { checkManagerAndSendEmail } from '../utils/requests';
import { notifyUserRequestCount } from '../lib/websocket';

const router = express.Router();

router.post("/requests", authenticateToken, async (req: Request, res: Response): Promise<any> => {
  let { managerId, type, dates } = req.body;
  if (!managerId || !type || !dates) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  let reqUser = req.user;

  if (!reqUser) return res.status(401).json({ error: 'Unauthorized' });

  try {
    let user = await prisma.user.findUnique({
      where: {
        id: reqUser.id
      }
    });

    if (!user) return res.status(401).json({ error: 'User not found' });


    let manager = await prisma.user.findUnique({
      where: {
        id: managerId
      }
    });

    if (!manager) return res.status(404).json({ error: 'Manager not found' });

    if (managerId !== user.managerId) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    dates = dates.map((date: string) => new Date(date));

    let newRequest = await prisma.kerelem.create({
      data: {
        userId: user.id,
        type: type,
        dates: dates,
        managerId: manager.id,
        managerName: manager.name,
        submittingName: user.name,
        submittingEmailIdentifier: user.email.split('@')[1]
      }
    });

    checkManagerAndSendEmail(manager, user, dates);

    notifyUserRequestCount(manager.id);

    res.json(newRequest);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get("/requests/toapprove", authenticateToken, authorizeRole("irodavezeto"), async (req: Request, res: Response): Promise<any> => {
  let reqUser = req.user;

  if (!reqUser) return res.status(401).json({ error: 'Unauthorized' });

  try {
    let user = await prisma.user.findUnique({
      where: {
        id: reqUser.id
      }
    });

    if (!user) return res.status(401).json({ error: 'User not found' });

    let requests = await prisma.kerelem.findMany({
      where: {
        managerId: user.id,
        approved: false,
        rejected: false
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    res.json(requests.length);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get("/requests/own", authenticateToken, authorizeRole("felhasznalo"), async (req: Request, res: Response): Promise<any> => {
  let reqUser = req.user;
  console.log(reqUser);
  let { offset = 0, limit = 25 } = req.query;

  if (!reqUser) return res.status(401).json({ error: 'Unauthorized' });

  try {
    let user = await prisma.user.findUnique({
      where: {
        id: reqUser.id
      }
    });

    if (!user) return res.status(401).json({ error: 'User not found' });

    let requests = await prisma.kerelem.findMany({
      where: {
        userId: user.id
      },
      orderBy: {
        createdAt: 'desc'
      },
      skip: Number(offset),
      take: Number(limit)
    });

    res.json(requests);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.patch("/requests/:id/approve", authenticateToken, authorizeRole("irodavezeto"), async (req: Request, res: Response): Promise<any> => {
  let { id } = req.params;

  if (!id) return res.status(400).json({ error: 'Missing required fields' });

  let reqUser = req.user;

  if (!reqUser) return res.status(401).json({ error: 'Unauthorized' });

  try {
    let user = await prisma.user.findUnique({
      where: {
        id: reqUser.id
      }
    });

    if (!user) return res.status(401).json({ error: 'User not found' });

    let request = await prisma.kerelem.findUnique({
      where: {
        id: id
      }
    });

    if (!request) return res.status(404).json({ error: 'Request not found' });

    if (request.approved || request.rejected) return res.status(400).json({ error: 'Request already approved or rejected' });

    if (user.remainingDays < request.dates.length) return res.status(403).json({ error: 'User does not have anough days' });

    let szabadsag = await prisma.szabadsag.create({
      data: {
        userId: request.userId,
        type: request.type,
        dates: request.dates,
        managerId: request.managerId
      }
    });
    
    let updatedRequest = await prisma.kerelem.update({
      where: {
        id: id
      },
      data: {
        approved: true,
        szabadsagId: szabadsag.id
      }
    });

    await prisma.user.update({
      where: {
        id: request.userId
      },
      data: {
        remainingDays: {
          decrement: request.dates.length
        }
      }
    })

    notifyUserRequestCount(request.managerId);

    res.json(updatedRequest);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.patch("/requests/:id/reject", authenticateToken, authorizeRole("irodavezeto"), async (req: Request, res: Response): Promise<any> => {
  let { id } = req.params;
  let { reason = null } = req.body;

  if (!id) return res.status(400).json({ error: 'Missing required fields' });

  if (reason == null) return res.status(400).json({ error: 'Missing required fields' });

  let reqUser = req.user;

  if (!reqUser) return res.status(401).json({ error: 'Unauthorized' });

  try {
    let user = await prisma.user.findUnique({
      where: {
        id: reqUser.id
      }
    });

    if (!user) return res.status(401).json({ error: 'User not found' });

    let request = await prisma.kerelem.findUnique({
      where: {
        id: id
      }
    });

    if (!request) return res.status(404).json({ error: 'Request not found' });

    if (request.approved || request.rejected) return res.status(400).json({ error: 'Request already approved or rejected' });

    let updatedRequest = await prisma.kerelem.update({
      where: {
        id: id
      },
      data: {
        rejected: true,
        rejectedMessage: reason
      }
    });

    notifyUserRequestCount(request.managerId);

    res.json(updatedRequest);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.delete("/requests/:id", authenticateToken, authorizeRole("felhasznalo"), async (req: Request, res: Response): Promise<any> => {
  let { id } = req.params;

  if (!id) return res.status(400).json({ error: 'Missing required fields' });

  let reqUser = req.user;

  if (!reqUser) return res.status(401).json({ error: 'Unauthorized' });

  try {
    let user = await prisma.user.findUnique({
      where: {
        id: reqUser.id
      }
    });

    if (!user) return res.status(401).json({ error: 'User not found' });

    let request = await prisma.kerelem.findUnique({
      where: {
        id: id
      }
    });

    if (!request) return res.status(404).json({ error: 'Request not found' });

    if (user.role === 'felhasznalo' && (request.userId !== user.id || (request.approved || request.rejected))) return res.status(403).json({ error: 'Forbidden' });
    if (user.role === 'irodavezeto') return res.status(403).json({ error: 'Forbidden' });

    if (request.szabadsagId !== null) {
      let deletedSzabadsag = await prisma.szabadsag.delete({
        where: {
          id: request.szabadsagId
        }
      });

      await prisma.user.update({
        where: {
          id: request.userId
        },
        data: {
          remainingDays: {
            increment: request.dates.length
          }
        }
      });
    }

    let deletedRequest = await prisma.kerelem.delete({
      where: {
        id: id
      }
    });

    notifyUserRequestCount(request.managerId);

    res.json(deletedRequest);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get("/requests/:id", authenticateToken, async (req: Request, res: Response): Promise<any> => {
  let { id } = req.params;

  if (!id) return res.status(400).json({ error: 'Missing required fields' });

  let reqUser = req.user;

  if (!reqUser) return res.status(401).json({ error: 'Unauthorized' });

  try {
    let user = await prisma.user.findUnique({
      where: {
        id: reqUser.id
      }
    });

    if (!user) return res.status(401).json({ error: 'User not found' });

    let request = await prisma.kerelem.findUnique({
      where: {
        id: id
      }
    });

    if (!request) return res.status(404).json({ error: 'Request not found' });

    if (user.role === 'felhasznalo' && request.userId !== user.id) return res.status(403).json({ error: 'Forbidden' });

    res.json(request);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get("/requests", authenticateToken, authorizeRole("irodavezeto"), async (req: Request, res: Response): Promise<any> => {
  let reqUser = req.user;
  let { offset = 0, limit = 25 } = req.query;

  if (!reqUser) return res.status(401).json({ error: 'Unauthorized' });

  try {
    let user = await prisma.user.findUnique({
      where: {
        id: reqUser.id
      }
    });

    if (!user) return res.status(401).json({ error: 'User not found' });

    let requests;

    if (user.role === 'irodavezeto' || user.role === 'jegyzo') {
      requests = await prisma.kerelem.findMany({
        where: {
          managerId: user.id
        },
        orderBy: {
          createdAt: 'desc'
        },
        skip: Number(offset),
        take: Number(limit)
      });
    }

    if (user.role === 'admin') {
      requests = await prisma.kerelem.findMany({
        where: {
          submittingEmailIdentifier: user.email.split('@')[1]
        },
        orderBy: {
          createdAt: 'desc'
        },
        skip: Number(offset),
        take: Number(limit)
      });
    }

    res.json(requests);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;