import express, { Express } from 'express';
import { createServer, Server } from 'http';
import path from 'path';
import routes from './routes';
import { wsManager } from './websocket';

export function createApp(): { app: Express; server: Server } {
  const app = express();
  const server = createServer(app);

  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true }));
  app.use(express.static(path.join(__dirname, '../../public')));

  app.use('/api', routes);

  wsManager.initialize(server);

  app.get('/', (_req, res) => {
    res.sendFile(path.join(__dirname, '../../public/index.html'));
  });

  return { app, server };
}
