import { WebSocketServer, WebSocket } from 'ws';
import { Server } from 'http';
import { WSMessage, WSMessageType } from '../types';

class WebSocketManager {
  private wss: WebSocketServer | null = null;
  private clients: Set<WebSocket> = new Set();

  initialize(server: Server): void {
    this.wss = new WebSocketServer({ server });

    this.wss.on('connection', (ws: WebSocket) => {
      console.log('[WS] Client connected');
      this.clients.add(ws);

      ws.on('close', () => {
        this.clients.delete(ws);
      });

      ws.on('error', () => {
        this.clients.delete(ws);
      });
    });
  }

  broadcast(type: WSMessageType, payload: any): void {
    const message: WSMessage = { type, payload, timestamp: new Date() };
    const str = JSON.stringify(message);

    this.clients.forEach(client => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(str);
      }
    });
  }

  sendStatus(status: string, details?: any): void {
    this.broadcast('status_update', { status, ...details });
  }

  sendLog(message: string): void {
    this.broadcast('log', { message });
  }

  sendError(error: string): void {
    this.broadcast('error', { message: error });
  }
}

export const wsManager = new WebSocketManager();
