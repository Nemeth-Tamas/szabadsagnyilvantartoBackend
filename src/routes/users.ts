import express from 'express';
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
import { Request, Response } from 'express';
import { checkStatus } from '@/utils/users';
import prisma from '@/lib/db';
import { authenticateToken, authorizeRole } from '@/lib/middleware';
import { User } from '@prisma/client';
import bcrypt from 'bcrypt';
import cors from 'cors';

dotenv.config();

const router = express.Router();

router.post("/login", async (req: Request, res: Response): Promise<any> => {
  const { email, password } = req.body;

  try {
    const user = await prisma.user.findUnique({
      where: {
        email
      }
    });

    if (!user) return res.status(401).json({ error: 'User not found' });

    const isPasswordValid = bcrypt.compareSync(password, user.password);

    if (!isPasswordValid) {
      return res.status(401).json({ error: 'Invalid password' });
    }

    if (!process.env.JWT_SECRET) process.exit("JWT_SECRET not set");

    const accessToken = jwt.sign({
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      maxDays: user.maxDays,
      remainingDays: user.remainingDays,
      managerId: user.managerId
    }, process.env.JWT_SECRET, { expiresIn: '15m' });

    const refreshToken = jwt.sign({
      id: user.id,
      email: user.email
    }, process.env.JWT_SECRET, { expiresIn: '7d' });

    await prisma.refreshToken.create({
      data: {
        token: refreshToken,
        userId: user.id
      }
    });

    res.cookie('refreshToken', refreshToken, {httpOnly: true });
    res.json({ accessToken });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post("/refresh-token", async (req: Request, res: Response): Promise<any> => {
  const refreshToken = req.cookies.refreshToken;

  if (!refreshToken) return res.status(401).json({ error: 'Unauthorized' });

  try {
    if (!process.env.JWT_SECRET) process.exit("JWT_SECRET not set");

    const decoded = jwt.verify(refreshToken, process.env.JWT_SECRET) as { id: string, email: string, exp: number };

    const storedToken = await prisma.refreshToken.findUnique({
      where: {
        token: refreshToken
      }
    });

    if (!storedToken) return res.status(401).json({ error: 'Invalid refresh token' });

    const user = await prisma.user.findUnique({
      where: {
        id: decoded.id
      }
    });

    if (!user) return res.status(404).json({ error: 'User not found' });

    const accessToken = jwt.sign({
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      maxDays: user.maxDays,
      remainingDays: user.remainingDays,
      managerId: user.managerId
    }, process.env.JWT_SECRET, { expiresIn: '15m' });

    const currentTime = Math.floor(Date.now() / 1000);
    const oneDayInSeconds = 24 * 60 * 60;
    if (decoded.exp - currentTime < oneDayInSeconds) {
      const newRefreshToken = jwt.sign({
        id: user.id,
        email: user.email
      }, process.env.JWT_SECRET, { expiresIn: '7d' });

      await prisma.refreshToken.update({
        where: {
          token: refreshToken
        },
        data: {
          token: newRefreshToken
        }
      });

      res.cookie('refreshToken', newRefreshToken, {httpOnly: true });
    }

    res.json({ accessToken });
  }
  catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post("/logout", async (req: Request, res: Response): Promise<any> => {
  const refreshToken = req.cookies.refreshToken;

  if (!refreshToken) return res.status(401).json({ error: 'Unauthorized' });

  try {
    await prisma.refreshToken.delete({
      where: {
        token: refreshToken
      }
    });

    res.clearCookie('refreshToken');
    res.json({ message: 'Logged out' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post("/register", authenticateToken, authorizeRole('admin'), async (req: Request, res: Response): Promise<any> => {
  const { email, name, password, role, maxDays, remainingDays, managerId } = req.body;

  try {
    const user = await prisma.user.findUnique({
      where: {
        email
      }
    });

    if (user) return res.status(400).json({ error: 'User already exists' });

    const newUser = await prisma.user.create({
      data: {
        email,
        name,
        password: bcrypt.hashSync(password, 10),
        role,
        maxDays: parseInt(maxDays) || 0,
        remainingDays: parseInt(remainingDays) || 0,
        managerId
      }
    });

    res.json(newUser);
  }
  catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get("/users", authenticateToken, authorizeRole('irodavezeto'), async (req: Request, res: Response): Promise<any> => {
  let reqUser = req.user;

  if (!reqUser) return res.status(401).json({ error: 'User Object Not Found' });

  try {
    let usersList: User[] = [];
    if (reqUser.role === 'jegyzo' || reqUser.role === 'admin') {
      usersList = await prisma.user.findMany({
        orderBy: {
          name: 'asc'
        }
      });
    } else if (reqUser.role === 'irodavezeto') {
      usersList = await prisma.user.findMany({
        where: {
          managerId: reqUser.id
        },
        orderBy: {
          name: 'asc'
        },
      });
    }

    let toReturn = [];
    for (let user of usersList) {
      if (user.email.endsWith(reqUser.email.split('@')[1])) {
        toReturn.push(await checkStatus(user));
      }
    }

    res.json(toReturn);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get("/user/:id", authenticateToken, authorizeRole("irodavezeto"), async (req: Request, res: Response): Promise<any> => {
  let reqUser = req.user;

  if (!reqUser) return res.status(401).json({ error: 'User Object Not Found' });

  try {
    let user: User | null = null;

    if (reqUser.role === 'jegyzo' || reqUser.role === 'admin') {
      user = await prisma.user.findUnique({
        where: {
          id: req.params.id
        }
      });
    } else if (reqUser.role === 'irodavezeto') {
      user = await prisma.user.findFirst({
        where: {
          id: req.params.id,
          managerId: reqUser.id
        }
      });
    }

    if (!user) return res.status(404).json({ error: 'User not found' });

    if (!user.email.endsWith(reqUser.email.split('@')[1])) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }

    res.json(await checkStatus(user));
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.patch("/user/:id", authenticateToken, authorizeRole("admin"), async (req: Request, res: Response): Promise<any> => {
  let reqUser = req.user;

  if (!reqUser) return res.status(401).json({ error: 'User Object Not Found' });

  try {
    let user = await prisma.user.findUnique({
      where: {
        id: req.params.id
      }
    });

    if (!user) return res.status(404).json({ error: 'User not found' });

    if (!user.email.endsWith(reqUser.email.split('@')[1])) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }

    const { name = null, email = null, role = null, maxDays = null, remainingDays = null, managerId = null, password = null } = req.body;

    let newuser = await prisma.user.update({
      where: {
        id: req.params.id
      },
      data: {
        name: name || user.name,
        email: email || user.email,
        role: role || user.role,
        maxDays: parseInt(maxDays) || user.maxDays,
        remainingDays: parseInt(remainingDays) || user.remainingDays,
        managerId: managerId || user.managerId,
        password: password || user.password
      }
    });

    res.json(await checkStatus(newuser));
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.delete("/user/:id", authenticateToken, authorizeRole("admin"), async (req: Request, res: Response): Promise<any> => {
  let reqUser = req.user;

  if (!reqUser) return res.status(401).json({ error: 'User Object Not Found' });

  try {
    let user = await prisma.user.findUnique({
      where: {
        id: req.params.id
      }
    });

    if (!user) return res.status(404).json({ error: 'User not found' });

    if (!user.email.endsWith(reqUser.email.split('@')[1])) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }

    try {
      await prisma.szabadsag.deleteMany({
        where: {
          userId: req.params.id
        }
      });
    } catch (error) {}
    try {
      await prisma.kerelem.deleteMany({
        where: {
          userId: req.params.id
        }
      });
    } catch (error) {}
    try {
      await prisma.plan.delete({
        where: {
          userId: req.params.id
        }
      });
    } catch (error) {}
    try {
      await prisma.tappenz.deleteMany({
        where: {
          userId: req.params.id
        }
      });
    } catch (error) {}
    try {
      await prisma.uzenetek.deleteMany({
        where: {
          userId: req.params.id
        }
      });
    } catch (error) {}
    try {
      await prisma.refreshToken.deleteMany({
        where: {
          userId: req.params.id
        }
      });
    } catch (error) {}

    await prisma.user.delete({
      where: {
        id: req.params.id
      }
    });

    res.json({ message: 'User deleted' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;