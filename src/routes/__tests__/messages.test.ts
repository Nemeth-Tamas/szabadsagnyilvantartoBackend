import request from 'supertest';
import express from 'express';
import messagesRouter from '../messages';
import prisma from '../../lib/db';
import { authenticateToken, authorizeRole } from '../../lib/middleware';

let mockReqUser = {
  id: '1',
  name: 'Admin User',
  email: 'admin@example.com',
  role: 'admin',
  maxDays: 20,
  remainingDays: 15,
  managerId: null
};

jest.mock('../../lib/middleware', () => ({
  authenticateToken: jest.fn((req, res, next) => next()),
  authorizeRole: jest.fn((role) => (req: any, res: any, next: any) => next())
}));

jest.mock('../../lib/db', () => ({
  uzenetek: {
    findMany: jest.fn(),
    create: jest.fn()
  }
}));

const app = express();
app.use(express.json());
app.use(messagesRouter);

describe('Messages Routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockReqUser = {
      id: '1',
      name: 'Admin User',
      email: 'admin@example.com',
      role: 'admin',
      maxDays: 20,
      remainingDays: 15,
      managerId: null
    };
    
    // Reset mock implementations
    (authenticateToken as jest.Mock).mockImplementation((req: any, res: any, next: any) => {
      req.user = mockReqUser;
      next();
    });
    
    (authorizeRole as jest.Mock).mockImplementation((role) => (req: any, res: any, next: any) => {
      next();
    });
  });

  describe('GET /messages', () => {
    it('should return 401 if user is not authenticated', async () => {
      (authenticateToken as jest.Mock).mockImplementation((req: any, res: any, next: any) => {
        req.user = null;
        next();
      });

      const response = await request(app).get('/messages');
      expect(response.status).toBe(401);
      expect(response.body).toEqual({ error: 'Unauthorized' });
    });

    it('should return messages for authenticated user', async () => {
      const mockMessages = [{ id: 1, message: 'Test message' }];
      (authenticateToken as jest.Mock).mockImplementation((req: any, res: any, next: any) => {
        req.user = { id: 1 };
        next();
      });
      (authorizeRole as jest.Mock).mockImplementation((role) => (req: any, res: any, next: any) => {
        next();
      });
      (prisma.uzenetek.findMany as jest.Mock).mockResolvedValue(mockMessages);

      const response = await request(app).get('/messages');
      expect(response.status).toBe(200);
      expect(response.body).toEqual(mockMessages);
    });

    it('should return 500 if there is a server error', async () => {
      (authenticateToken as jest.Mock).mockImplementation((req: any, res: any, next: any) => {
        req.user = { id: 1 };
        next();
      });
      (authorizeRole as jest.Mock).mockImplementation((role) => (req: any, res: any, next: any) => {
        next();
      });
      (prisma.uzenetek.findMany as jest.Mock).mockRejectedValue(new Error('Server error'));

      const response = await request(app).get('/messages');
      expect(response.status).toBe(500);
      expect(response.body).toEqual({ error: 'Internal Server Error' });
    });
  });

  describe('POST /messages', () => {
    it('should return 401 if user is not authenticated', async () => {
      (authenticateToken as jest.Mock).mockImplementation((req: any, res: any, next: any) => {
        req.user = null;
        next();
      });

      const response = await request(app).post('/messages').send({});
      expect(response.status).toBe(401);
      expect(response.body).toEqual({ error: 'Unauthorized' });
    });

    it('should return 400 if required fields are missing', async () => {
      (authenticateToken as jest.Mock).mockImplementation((req: any, res: any, next: any) => {
        req.user = { id: 1 };
        next();
      });
      (authorizeRole as jest.Mock).mockImplementation((role) => (req: any, res: any, next: any) => {
        next();
      });

      const response = await request(app).post('/messages').send({});
      expect(response.status).toBe(400);
      expect(response.body).toEqual({ error: 'Missing fields' });
    });

    it('should create a new message for authenticated user', async () => {
      const newMessage = { id: 1, message: 'Test message' };
      (authenticateToken as jest.Mock).mockImplementation((req: any, res: any, next: any) => {
        req.user = { id: 1, name: 'Test User' };
        next();
      });
      (authorizeRole as jest.Mock).mockImplementation((role) => (req: any, res: any, next: any) => {
        next();
      });
      (prisma.uzenetek.create as jest.Mock).mockResolvedValue(newMessage);

      const response = await request(app).post('/messages').send({
        userId: 1,
        date: new Date().toISOString(),
        message: 'Test message'
      });
      expect(response.status).toBe(200);
      expect(response.body).toEqual(newMessage);
    });

    it('should return 500 if there is a server error', async () => {
      (authenticateToken as jest.Mock).mockImplementation((req: any, res: any, next: any) => {
        req.user = { id: 1, name: 'Test User' };
        next();
      });
      (authorizeRole as jest.Mock).mockImplementation((role) => (req: any, res: any, next: any) => {
        next();
      });
      (prisma.uzenetek.create as jest.Mock).mockRejectedValue(new Error('Server error'));

      const response = await request(app).post('/messages').send({
        userId: 1,
        date: new Date().toISOString(),
        message: 'Test message'
      });
      expect(response.status).toBe(500);
      expect(response.body).toEqual({ error: 'Internal Server Error' });
    });
  });
});