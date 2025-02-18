import WebSocket, { Server } from 'ws';
import jwt from 'jsonwebtoken';
import prisma from './db';
import type http from 'http';
import dotenv from 'dotenv';

dotenv.config();

interface ConnectedUsers {
  [key: string]: WebSocket;
}

interface WSMessage {
  type: string;
  count?: number;
  message?: string;
}

class TokenError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TokenError";
  }
}

const verifyToken = (token: string): Promise<{id: string}> => {
  return new Promise((resolve, reject) => {
    jwt.verify(token, process.env.JWT_SECRET as string, (err, decoded) => {
      if (err) {
        return reject(new TokenError('Invalid token'));
      }
      resolve(decoded as { id: string });
    });
  });
};

const connectedUsers: Map<string, WebSocket> = new Map();


export const sendMessageToUser = (userId: string, message: WSMessage) => {
  const userSocket = connectedUsers.get(userId);
  // Only send if socket exists and is open
  if (userSocket?.readyState === WebSocket.OPEN) {
    userSocket.send(JSON.stringify(message));
  } else {
    console.log(`User ${userId} is not connected or socket not open`);
    // Clean up dead connection
    connectedUsers.delete(userId);
  }
};

export const setupWebSocket = (server: http.Server) => {
  const wss = new Server({ server });

  const pingInterval = setInterval(() => {
    wss.clients.forEach((ws: WebSocket & { isAlive?: boolean }) => {
      if (ws.isAlive === false) {
        return ws.terminate();
      }
      ws.isAlive = false;
      ws.ping();
    })
  }, 30000);

  wss.on('close', () => {
    clearInterval(pingInterval);
  });

  wss.on('connection', async (ws: WebSocket & { isAlive?: boolean }, req) => {
    ws.isAlive = true;
    ws.on('pong', () => { ws.isAlive = true; });

    try {
      const token = new URL(req.url as string, 'ws://localhost').searchParams.get('token');
      if (!token) {
        throw new Error('Token missing');
      }

      const decoded = await verifyToken(token);
      const userId = decoded.id;

      const existingConnection = connectedUsers.get(userId);
      if (existingConnection) {
        existingConnection.terminate();
      }

      connectedUsers.set(userId, ws);

      ws.on('message', (message: string) => {
        try {
          const parsedMessage = JSON.parse(message.toString());
          console.log('received: %s', parsedMessage);
        } catch (error) {
          console.error('Failed to parse message:', error);
        }
      });

      ws.on('error', (error) => {
        console.error(`WebSocket error: ${error} for user ${userId}`);
      });

      ws.on('close', () => {
        connectedUsers.delete(userId);
        console.log(`User with ID ${userId} disconnected`);
      });

      await notifyUserRequestCount(userId);
    } catch (error) {
      console.error('Connection error:', error);
      ws.close(1008, error instanceof Error ? error.message : 'Connection error');
    }
  });
}

export const notifyUserRequestCount = async (userId: string) => {
  let numOfRequests = 0;
  try {
    numOfRequests = (await prisma.kerelem.findMany({
      where: {
        managerId: userId,
        approved: false,
        rejected: false,
      }
    })).length;
  } catch (error) {
    console.error(error);
  }
  console.log(`Sending initial request number to user ${userId}: ${numOfRequests}`);
  sendMessageToUser(userId, { type: "kerelmek", count: numOfRequests });
};