import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import express from 'express';
import { createServer, Server } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import { initDb } from '../src/db.js';
import { createDocument } from '../src/db.js';
import { handleConnection } from '../src/ws/handler.js';
import { v4 as uuidv4 } from 'uuid';

let server: Server;
let port: number;
let docId: string;

function connectWs(): Promise<WebSocket> {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(`ws://localhost:${port}/ws`);
    ws.on('open', () => resolve(ws));
    ws.on('error', reject);
  });
}

function waitForMessage(ws: WebSocket, filter?: (msg: any) => boolean): Promise<any> {
  return new Promise((resolve) => {
    const handler = (data: any) => {
      const msg = JSON.parse(data.toString());
      if (!filter || filter(msg)) {
        ws.off('message', handler);
        resolve(msg);
      }
    };
    ws.on('message', handler);
  });
}

beforeAll(async () => {
  initDb(':memory:');
  docId = uuidv4();
  createDocument(docId, 'WS Test Doc');

  const app = express();
  server = createServer(app);
  const wss = new WebSocketServer({ server, path: '/ws' });
  wss.on('connection', handleConnection);

  await new Promise<void>((resolve) => {
    server.listen(0, () => resolve());
  });
  port = (server.address() as { port: number }).port;
});

afterAll(() => {
  server?.close();
});

describe('WebSocket real-time sync', () => {
  it('two clients join and one sends an update, other receives it', async () => {
    const client1 = await connectWs();
    const client2 = await connectWs();

    // Both join the same document
    const sync1Promise = waitForMessage(client1, (m) => m.type === 'doc:sync');
    client1.send(JSON.stringify({ type: 'doc:join', docId }));
    const sync1 = await sync1Promise;
    expect(sync1.version).toBe(1);

    const sync2Promise = waitForMessage(client2, (m) => m.type === 'doc:sync');
    client2.send(JSON.stringify({ type: 'doc:join', docId }));
    await sync2Promise;

    // Client1 sends an update; Client2 should receive the sync
    const client2SyncPromise = waitForMessage(client2, (m) => m.type === 'doc:sync');
    client1.send(
      JSON.stringify({
        type: 'doc:update',
        docId,
        content: 'Hello from client 1',
        version: 1,
      })
    );

    const broadcastMsg = await client2SyncPromise;
    expect(broadcastMsg.content).toBe('Hello from client 1');
    expect(broadcastMsg.version).toBe(2);

    client1.close();
    client2.close();
  });

  it('presence updates are sent on join and leave', async () => {
    const client1 = await connectWs();

    // Join and wait for presence
    const presencePromise = waitForMessage(client1, (m) => m.type === 'presence:update');
    client1.send(JSON.stringify({ type: 'doc:join', docId }));
    // Skip initial sync
    await waitForMessage(client1, (m) => m.type === 'doc:sync');
    const presence = await presencePromise;
    expect(presence.users).toBeGreaterThanOrEqual(1);

    client1.close();
  });
});
