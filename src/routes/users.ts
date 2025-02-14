import express from 'express';
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
import { Request, Response } from 'express';
import { checkStatus } from '@/utils/users';
import prisma from '@/lib/db';
import { authenticateToken, authorizeRole } from '@/lib/middleware';
import { User } from '@prisma/client';

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

    const isPasswordValid = password === user.password;

    if (!isPasswordValid) {
      return res.status(401).json({ error: 'Invalid password' });
    }

    if (!process.env.JWT_SECRET) process.exit("JWT_SECRET not set");
    const token = jwt.sign({
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      maxDays: user.maxDays,
      remainingDays: user.remainingDays,
      managerId: user.managerId
    }, process.env.JWT_SECRET, { expiresIn: '7d' });

    res.json({ token });
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
        password,
        role,
        maxDays,
        remainingDays,
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
      usersList = await prisma.user.findMany({});
    } else if (reqUser.role === 'irodavezeto') {
      usersList = await prisma.user.findMany({
        where: {
          managerId: reqUser.id
        }
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

export default router;