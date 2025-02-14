export interface User_JWT {
  id: string;
  name: string;
  email: string;
  role: 'felhasznalo' | 'irodavezeto' | 'jegyzo' | 'admin';
  maxDays: number;
  remainingDays: number;
  managerId: string;
  iat: number;
  exp: number;
}

declare module 'express-serve-static-core' {
  interface Request {
    user?: User_JWT;
  }
}