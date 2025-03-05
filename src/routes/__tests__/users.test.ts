import request from 'supertest';
import express from 'express';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import cookieParser from 'cookie-parser';
import prisma from '../../lib/db';
import usersRouter from '../users';
import { checkStatus } from '../../utils/users';

// Create a mock user that can be modified per test
let mockReqUser = {
  id: '1',
  name: 'Admin User',
  email: 'admin@example.com',
  role: 'admin',
  maxDays: 20,
  remainingDays: 15,
  managerId: null
};

// Mock middleware modules with ability to set req.user
jest.mock('../../lib/middleware', () => ({
  authenticateToken: (req: any, res: any, next: any) => {
    req.user = mockReqUser; // Use the configurable mock user
    next();
  },
  authorizeRole: (role: any) => (req: any, res: any, next: any) => {
    // This would check the role in real middleware
    // For tests, we'll just pass through since we can control mockReqUser.role
    next();
  },
}));

// Mock jwt verification
jest.mock('jsonwebtoken', () => ({
  sign: jest.fn().mockImplementation(() => 'mocked-token'),
  verify: jest.fn().mockImplementation(() => ({ id: '1', email: 'test@example.com', exp: Math.floor(Date.now() / 1000) + 60 * 60 })),
}));

const app = express();
app.use(express.json());
app.use(cookieParser());
app.use(usersRouter);

jest.mock('../../lib/db', () => ({
  user: {
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
  refreshToken: {
    findMany: jest.fn(),
    deleteMany: jest.fn(),
    create: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
  szabadsag: {
    deleteMany: jest.fn(),
  },
  kerelem: {
    deleteMany: jest.fn(),
  },
  plan: {
    delete: jest.fn(),
  },
  tappenz: {
    deleteMany: jest.fn(),
  },
  uzenetek: {
    deleteMany: jest.fn(),
  },
}));

jest.mock('../../utils/users', () => ({
  checkStatus: jest.fn().mockImplementation(user => Promise.resolve(user)),
}));

describe('Users API', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.JWT_SECRET = 'testsecret';
    
    // Reset the mockReqUser to default admin state before each test
    mockReqUser = {
      id: '1',
      name: 'Admin User',
      email: 'admin@example.com',
      role: 'admin',
      maxDays: 20,
      remainingDays: 15,
      managerId: null
    };
  });
  
  describe('POST /login', () => {
    const mockUser = {
      id: '1',
      name: 'Test User',
      email: 'test@example.com',
      password: bcrypt.hashSync('password', 10),
      role: 'user',
      maxDays: 20,
      remainingDays: 15,
      managerId: '2',
    };

    it('should return 401 if user is not found', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(null);

      const response = await request(app)
        .post('/login')
        .send({ email: 'test@example.com', password: 'password' });

      expect(response.status).toBe(401);
      expect(response.body).toEqual({ error: 'User not found' });
    });

    it('should return 401 if password is invalid', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(mockUser);

      const response = await request(app)
        .post('/login')
        .send({ email: 'test@example.com', password: 'wrongpassword' });

      expect(response.status).toBe(401);
      expect(response.body).toEqual({ error: 'Invalid password' });
    });

    it('should return 500 if JWT_SECRET is not set', async () => {
      const originalJwtSecret = process.env.JWT_SECRET;
      delete process.env.JWT_SECRET;
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(mockUser);

      const response = await request(app)
        .post('/login')
        .send({ email: 'test@example.com', password: 'password' });

      expect(response.status).toBe(500);
      expect(response.body).toEqual({ error: 'Internal server error' });
      
      // Restore JWT_SECRET for subsequent tests
      process.env.JWT_SECRET = originalJwtSecret;
    });

    it('should return accessToken and set refreshToken cookie on successful login', async () => {
      process.env.JWT_SECRET = 'testsecret';
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(mockUser);
      (prisma.refreshToken.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.refreshToken.create as jest.Mock).mockResolvedValue({});

      const response = await request(app)
        .post('/login')
        .send({ email: 'test@example.com', password: 'password' });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('accessToken');
      expect(response.headers['set-cookie']).toBeDefined();
    });
  });

  describe('POST /refresh-token', () => {
    const mockUser = {
      id: '1',
      name: 'Test User',
      email: 'test@example.com',
      role: 'user',
      maxDays: 20,
      remainingDays: 15,
      managerId: '2',
    };

    it('should return 401 if no refresh token is provided', async () => {
      const response = await request(app)
        .post('/refresh-token')
        .send();

      expect(response.status).toBe(401);
      expect(response.body).toEqual({ error: 'Unauthorized' });
    });

    it('should return 500 if JWT_SECRET is not set', async () => {
      const originalJwtSecret = process.env.JWT_SECRET;
      delete process.env.JWT_SECRET;
      
      const response = await request(app)
        .post('/refresh-token')
        .set('Cookie', ['refreshToken=valid-refresh-token'])
        .send();

      expect(response.status).toBe(500);
      expect(response.body).toEqual({ error: 'Internal server error' });
      
      // Restore JWT_SECRET for subsequent tests
      process.env.JWT_SECRET = originalJwtSecret;
    });

    it('should return 401 if refresh token is invalid', async () => {
      // Setup for token verification
      (jwt.verify as jest.Mock).mockImplementationOnce(() => ({ id: '1', email: 'test@example.com' }));
      
      // Mock the findUnique to return null, simulating an invalid token
      (prisma.refreshToken.findUnique as jest.Mock).mockResolvedValue(null);

      const response = await request(app)
        .post('/refresh-token')
        .set('Cookie', ['refreshToken=invalid-refresh-token'])
        .send();

      expect(response.status).toBe(401);
      expect(response.body).toEqual({ error: 'Invalid refresh token' });
    });

    it('should return 404 if user is not found', async () => {
      // Setup for token verification
      (jwt.verify as jest.Mock).mockImplementationOnce(() => ({ id: '1', email: 'test@example.com' }));
      
      // Mock the refreshToken.findUnique to return a valid token
      (prisma.refreshToken.findUnique as jest.Mock).mockResolvedValue({ 
        token: 'valid-refresh-token',
        userId: '1'
      });
      
      // Mock user.findUnique to return null, simulating user not found
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(null);

      const response = await request(app)
        .post('/refresh-token')
        .set('Cookie', ['refreshToken=valid-refresh-token'])
        .send();

      expect(response.status).toBe(404);
      expect(response.body).toEqual({ error: 'User not found' });
    });

    it('should return accessToken and set new refreshToken cookie on successful refresh', async () => {
      // Setup for token verification
      (jwt.verify as jest.Mock).mockImplementationOnce(() => ({ id: '1', email: 'test@example.com' }));
      
      // Mock the refreshToken.findUnique to return a valid token
      (prisma.refreshToken.findUnique as jest.Mock).mockResolvedValue({ 
        token: 'valid-refresh-token',
        userId: '1'
      });
      
      // Mock user.findUnique to return the user
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(mockUser);
      
      // Mock refreshToken.update for the token rotation
      (prisma.refreshToken.update as jest.Mock).mockResolvedValue({
        token: 'new-refresh-token',
        userId: '1'
      });

      const response = await request(app)
        .post('/refresh-token')
        .set('Cookie', ['refreshToken=valid-refresh-token'])
        .send();

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('accessToken');
      expect(response.headers['set-cookie']).toBeDefined();
    });
  });

  describe('POST /logout', () => {
    it('should clear cookie and return success message', async () => {
      (prisma.refreshToken.delete as jest.Mock).mockResolvedValue({});

      const response = await request(app)
        .post('/logout')
        .set('Cookie', ['refreshToken=valid-refresh-token'])
        .send();

      expect(response.status).toBe(200);
      expect(response.body).toEqual({ message: 'Logged out' });
      expect(response.headers['set-cookie']).toBeDefined();
    });
  });

  describe('POST /register', () => {
    const mockAdminUser = {
      id: '1',
      name: 'Admin User',
      email: 'admin@example.com',
      password: bcrypt.hashSync('adminpassword', 10),
      role: 'admin',
      maxDays: 20,
      remainingDays: 15,
      managerId: '2',
    };

    const newUser = {
      id: '2',
      name: 'New User',
      email: 'newuser@example.com',
      password: bcrypt.hashSync('password', 10),
      role: 'user',
      maxDays: 20,
      remainingDays: 15,
      managerId: '1',
    };

    it('should return 400 if user already exists', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(mockAdminUser);

      const response = await request(app)
        .post('/register')
        .send({
          email: 'admin@example.com',
          name: 'Admin User',
          password: 'adminpassword',
          role: 'admin',
          maxDays: 20,
          remainingDays: 15,
          managerId: '2',
        });

      expect(response.status).toBe(400);
      expect(response.body).toEqual({ error: 'User already exists' });
    });

    it('should return 500 if there is an internal server error', async () => {
      (prisma.user.findUnique as jest.Mock).mockRejectedValue(new Error('Internal server error'));

      const response = await request(app)
        .post('/register')
        .send({
          email: 'newuser@example.com',
          name: 'New User',
          password: 'password',
          role: 'user',
          maxDays: 20,
          remainingDays: 15,
          managerId: '1',
        });

      expect(response.status).toBe(500);
      expect(response.body).toEqual({ error: 'Internal server error' });
    });

    it('should create a new user and return the user object', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(null);
      (prisma.user.create as jest.Mock).mockResolvedValue(newUser);

      const response = await request(app)
        .post('/register')
        .send({
          email: 'newuser@example.com',
          name: 'New User',
          password: 'password',
          role: 'user',
          maxDays: 20,
          remainingDays: 15,
          managerId: '1',
        });

      expect(response.status).toBe(200);
      expect(response.body).toEqual(newUser);
    });
  });

  describe('GET /users', () => {
    const mockUsersList = [
      {
        id: '3',
        name: 'User One',
        email: 'user1@example.com',
        role: 'user',
        maxDays: 20,
        remainingDays: 15,
        managerId: '2',
      },
      {
        id: '4',
        name: 'User Two',
        email: 'user2@example.com',
        role: 'user',
        maxDays: 20,
        remainingDays: 15,
        managerId: '2',
      },
    ];

    it('should return a list of users for admin role', async () => {
      // Set the user role to admin
      mockReqUser.role = 'admin';
      mockReqUser.email = 'admin@example.com';
      
      (prisma.user.findMany as jest.Mock).mockResolvedValue(mockUsersList.map(user => ({
        ...user,
        email: `user@example.com` // Match the domain for email checking
      })));
      
      (checkStatus as jest.Mock).mockImplementation(user => Promise.resolve(user));

      const response = await request(app)
        .get('/users')
        .set('Authorization', 'Bearer mocked-token')
        .send();

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
      expect(prisma.user.findMany).toHaveBeenCalled();
    });

    it('should return a list of users for irodavezeto role', async () => {
      // Set the user role to irodavezeto
      mockReqUser.role = 'irodavezeto';
      mockReqUser.id = '2'; 
      mockReqUser.email = 'irodavezeto@example.com';
      
      const filteredUsers = mockUsersList.map(user => ({
        ...user,
        email: `user@example.com` // Match the domain for email checking
      }));
      
      (prisma.user.findMany as jest.Mock).mockResolvedValue(filteredUsers);
      (checkStatus as jest.Mock).mockImplementation(user => Promise.resolve(user));

      const response = await request(app)
        .get('/users')
        .set('Authorization', 'Bearer mocked-token')
        .send();

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
      expect(prisma.user.findMany).toHaveBeenCalledWith({
        where: { managerId: '2' }, 
        orderBy: { name: 'asc' }
      });
    });

    it('should return 500 if there is an internal server error', async () => {
      (prisma.user.findMany as jest.Mock).mockRejectedValue(new Error('Internal server error'));

      const response = await request(app)
        .get('/users')
        .set('Authorization', 'Bearer mocked-token')
        .send();

      expect(response.status).toBe(500);
      expect(response.body).toEqual({ error: 'Internal server error' });
    });
  });

  describe('GET /user/:id', () => {
    const mockUser = {
      id: '3',
      name: 'User One',
      email: 'user1@example.com',
      role: 'user',
      maxDays: 20,
      remainingDays: 15,
      managerId: '2',
    };

    beforeEach(() => {
      // Reset mockReqUser for these tests
      mockReqUser.email = 'admin@example.com';
    });

    it('should return user details for admin', async () => {
      mockReqUser.role = 'admin';
      
      (prisma.user.findUnique as jest.Mock).mockResolvedValue({
        ...mockUser,
        email: 'user1@example.com' // Same domain as mockReqUser.email
      });
      
      (checkStatus as jest.Mock).mockResolvedValue({
        ...mockUser,
        email: 'user1@example.com'
      });

      const response = await request(app)
        .get('/user/3')
        .set('Authorization', 'Bearer mocked-token')
        .send();

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('id', '3');
    });

    it('should return user details for irodavezeto if user belongs to them', async () => {
      // Set the user role to irodavezeto
      mockReqUser.role = 'irodavezeto';
      mockReqUser.id = '2';
      mockReqUser.email = 'irodavezeto@example.com';
      
      (prisma.user.findFirst as jest.Mock).mockResolvedValue({
        ...mockUser,
        email: 'user1@example.com' // Same domain
      });
      
      (checkStatus as jest.Mock).mockResolvedValue({
        ...mockUser,
        email: 'user1@example.com'
      });

      const response = await request(app)
        .get('/user/3')
        .set('Authorization', 'Bearer mocked-token')
        .send();

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('id', '3');
    });

    it('should return 404 if user is not found', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(null);
      (prisma.user.findFirst as jest.Mock).mockResolvedValue(null);

      const response = await request(app)
        .get('/user/999')
        .set('Authorization', 'Bearer mocked-token')
        .send();

      expect(response.status).toBe(404);
      expect(response.body).toEqual({ error: 'User not found' });
    });

    it('should return 403 if emails have different domains', async () => {
      mockReqUser.email = 'admin@example.com';
      
      (prisma.user.findUnique as jest.Mock).mockResolvedValue({
        ...mockUser,
        email: 'user1@different-domain.com' // Different domain!
      });

      const response = await request(app)
        .get('/user/3')
        .set('Authorization', 'Bearer mocked-token')
        .send();

      expect(response.status).toBe(403);
      expect(response.body).toEqual({ error: 'Insufficient permissions' });
    });
  });

  describe('PATCH /user/:id', () => {
    const mockUser = {
      id: '3',
      name: 'User One',
      email: 'user1@example.com',
      role: 'user',
      maxDays: 20,
      remainingDays: 15,
      managerId: '2',
      password: 'hashed-password',
    };

    it('should update user details successfully', async () => {
      mockReqUser.role = 'admin';
      mockReqUser.email = 'admin@example.com';
      
      (prisma.user.findUnique as jest.Mock).mockResolvedValue({
        ...mockUser,
        email: 'user1@example.com' // Same domain as mockReqUser
      });
      
      const updatedUser = { 
        ...mockUser, 
        name: 'Updated Name',
        maxDays: 25
      };
      
      (prisma.user.update as jest.Mock).mockResolvedValue(updatedUser);
      (checkStatus as jest.Mock).mockResolvedValue(updatedUser);

      const response = await request(app)
        .patch('/user/3')
        .set('Authorization', 'Bearer mocked-token')
        .send({
          name: 'Updated Name',
          maxDays: 25
        });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('name', 'Updated Name');
      expect(response.body).toHaveProperty('maxDays', 25);
    });

    it('should return 404 if user is not found', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(null);

      const response = await request(app)
        .patch('/user/999')
        .set('Authorization', 'Bearer mocked-token')
        .send({ name: 'Updated Name' });

      expect(response.status).toBe(404);
      expect(response.body).toEqual({ error: 'User not found' });
    });

    it('should return 403 if emails have different domains', async () => {
      mockReqUser.email = 'admin@example.com';
      
      (prisma.user.findUnique as jest.Mock).mockResolvedValue({
        ...mockUser,
        email: 'user1@different-domain.com' // Different domain!
      });

      const response = await request(app)
        .patch('/user/3')
        .set('Authorization', 'Bearer mocked-token')
        .send({ name: 'Updated Name' });

      expect(response.status).toBe(403);
      expect(response.body).toEqual({ error: 'Insufficient permissions' });
    });
  });

  describe('DELETE /user/:id', () => {
    const mockUser = {
      id: '3',
      name: 'User One',
      email: 'user1@example.com',
      role: 'user',
      maxDays: 20,
      remainingDays: 15,
      managerId: '2',
    };

    it('should delete user successfully', async () => {
      mockReqUser.role = 'admin';
      mockReqUser.email = 'admin@example.com';
      
      (prisma.user.findUnique as jest.Mock).mockResolvedValue({
        ...mockUser,
        email: 'user1@example.com' // Same domain as mockReqUser
      });
      
      (prisma.user.delete as jest.Mock).mockResolvedValue({});
      // Mock the various deleteMany calls
      (prisma.szabadsag.deleteMany as jest.Mock).mockResolvedValue({});
      (prisma.kerelem.deleteMany as jest.Mock).mockResolvedValue({});
      (prisma.plan.delete as jest.Mock).mockResolvedValue({});
      (prisma.tappenz.deleteMany as jest.Mock).mockResolvedValue({});
      (prisma.uzenetek.deleteMany as jest.Mock).mockResolvedValue({});
      (prisma.refreshToken.deleteMany as jest.Mock).mockResolvedValue({});

      const response = await request(app)
        .delete('/user/3')
        .set('Authorization', 'Bearer mocked-token')
        .send();

      expect(response.status).toBe(200);
      expect(response.body).toEqual({ message: 'User deleted' });
      expect(prisma.user.delete).toHaveBeenCalledWith({
        where: { id: '3' }
      });
    });

    it('should return 404 if user is not found', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(null);

      const response = await request(app)
        .delete('/user/999')
        .set('Authorization', 'Bearer mocked-token')
        .send();

      expect(response.status).toBe(404);
      expect(response.body).toEqual({ error: 'User not found' });
    });

    it('should return 403 if emails have different domains', async () => {
      mockReqUser.email = 'admin@example.com';
      
      (prisma.user.findUnique as jest.Mock).mockResolvedValue({
        ...mockUser,
        email: 'user1@different-domain.com' // Different domain!
      });

      const response = await request(app)
        .delete('/user/3')
        .set('Authorization', 'Bearer mocked-token')
        .send();

      expect(response.status).toBe(403);
      expect(response.body).toEqual({ error: 'Insufficient permissions' });
    });
  });
});