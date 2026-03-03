import express from 'express';
import cors from 'cors';
import path from 'path';
import { createServer } from 'http';
import { WebSocketServer } from 'ws';
import { initDb } from './db.js';
import documentsRouter from './routes/documents.js';
import { handleConnection } from './ws/handler.js';

const PORT = parseInt(process.env.PORT || '3001', 10);

// Initialize database
initDb();

const app = express();
app.use(cors());
app.use(express.json());

// REST API routes
app.use('/api/documents', documentsRouter);

// Serve static files in production
const publicDir = path.join(process.cwd(), 'public');
app.use(express.static(publicDir));

// SPA fallback — serve index.html for client-side routes (production only)
app.get('*', (_req, res) => {
  const indexPath = path.join(publicDir, 'index.html');
  res.sendFile(indexPath, (err) => {
    if (err) {
      res.status(404).send('Not found');
    }
  });
});

// Create HTTP server and attach WebSocket server
const server = createServer(app);
const wss = new WebSocketServer({ server, path: '/ws' });

wss.on('connection', (ws) => {
  handleConnection(ws);
});

server.listen(PORT, () => {
  console.log(`CollabPad server running on http://localhost:${PORT}`);
});

export { app, server, wss };
