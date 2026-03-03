import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import express from 'express';
import { createServer, Server } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import { initDb, getDocument } from '../src/db.js';
import { createDocument } from '../src/db.js';
import { handleConnection } from '../src/ws/handler.js';
import { v4 as uuidv4 } from 'uuid';

let server: Server;
let port: number;

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

describe('Conflict handling', () => {
  it('concurrent updates with same version — first wins, second gets rebased', async () => {
    const docId = uuidv4();
    createDocument(docId, 'Conflict Test');

    const client1 = await connectWs();
    const client2 = await connectWs();

    // Both join
    const join1 = waitForMessage(client1, (m) => m.type === 'doc:sync');
    client1.send(JSON.stringify({ type: 'doc:join', docId }));
    await join1;

    const join2 = waitForMessage(client2, (m) => m.type === 'doc:sync');
    client2.send(JSON.stringify({ type: 'doc:join', docId }));
    await join2;

    // Client1 sends update with version 1 (should succeed)
    const client1Confirm = waitForMessage(client1, (m) => m.type === 'doc:sync');
    client1.send(
      JSON.stringify({
        type: 'doc:update',
        docId,
        content: 'Edit from client 1',
        version: 1,
      })
    );
    const confirm1 = await client1Confirm;
    expect(confirm1.version).toBe(2);
    expect(confirm1.content).toBe('Edit from client 1');

    // Client2 sends update with stale version 1 (should be rejected with rebase)
    const client2Rebase = waitForMessage(client2, (m) => m.type === 'doc:sync');
    // Drain the broadcast from client1's update first
    // client2 already received the sync from client1's update
    // Now client2 tries with stale version
    client2.send(
      JSON.stringify({
        type: 'doc:update',
        docId,
        content: 'Edit from client 2',
        version: 1, // stale!
      })
    );
    const rebase = await client2Rebase;
    // Server should send back current state for rebase
    expect(rebase.type).toBe('doc:sync');
    expect(rebase.version).toBe(2);
    expect(rebase.content).toBe('Edit from client 1');

    // Verify DB state
    const dbDoc = getDocument(docId);
    expect(dbDoc!.version).toBe(2);
    expect(dbDoc!.content).toBe('Edit from client 1');

    // Now client2 retries with correct version
    const client2Retry = waitForMessage(client2, (m) => m.type === 'doc:sync');
    client2.send(
      JSON.stringify({
        type: 'doc:update',
        docId,
        content: 'Edit from client 2 (rebased)',
        version: 2,
      })
    );
    const retry = await client2Retry;
    expect(retry.version).toBe(3);
    expect(retry.content).toBe('Edit from client 2 (rebased)');

    // Verify final DB state
    const finalDoc = getDocument(docId);
    expect(finalDoc!.version).toBe(3);
    expect(finalDoc!.content).toBe('Edit from client 2 (rebased)');

    client1.close();
    client2.close();
  });

  it('version increments correctly with sequential updates', async () => {
    const docId = uuidv4();
    createDocument(docId, 'Sequential Test');

    const client = await connectWs();
    const joinSync = waitForMessage(client, (m) => m.type === 'doc:sync');
    client.send(JSON.stringify({ type: 'doc:join', docId }));
    await joinSync;

    // Send 3 sequential updates
    for (let i = 1; i <= 3; i++) {
      const syncPromise = waitForMessage(client, (m) => m.type === 'doc:sync');
      client.send(
        JSON.stringify({
          type: 'doc:update',
          docId,
          content: `Update ${i}`,
          version: i,
        })
      );
      const sync = await syncPromise;
      expect(sync.version).toBe(i + 1);
    }

    const doc = getDocument(docId);
    expect(doc!.version).toBe(4);
    expect(doc!.content).toBe('Update 3');

    client.close();
  });
});
