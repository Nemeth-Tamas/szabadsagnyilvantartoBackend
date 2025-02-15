import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
import { Request, Response, NextFunction } from 'express';
import { User_JWT } from '@/types/user';

dotenv.config();

const roleHierarchy = {
  felhasznalo: 0,
  irodavezeto: 1,
  jegyzo: 2,
  admin: 3,
}

export const authenticateToken = (req: Request, res: Response, next: NextFunction) => {
  const token = req.headers['authorization']?.split(' ')[1];
  
  if (!token) {
    res.status(401).json({ error: 'Access denied' });
    return;
  }

  try {
    if (!process.env.JWT_SECRET) process.exit("JWT_SECRET not set");
    const decoded = jwt.verify(token, process.env.JWT_SECRET) as User_JWT;
    req.user = decoded;
    next();
  } catch (error) {
    res.status(401).json({ error: 'Invalid token' });
  };
};

export const authorizeRole = (requiredRole: 'felhasznalo' | 'irodavezeto' | 'jegyzo' | 'admin') => (req: Request, res: Response, next: NextFunction) => {
  const userRole = req.user?.role;

  if (!userRole || roleHierarchy[userRole] < roleHierarchy[requiredRole as 'felhasznalo']) {
    res.status(403).json({ error: 'Insufficient permissions' });
    return;
  }

  next();
};