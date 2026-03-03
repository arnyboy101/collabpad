import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import express from 'express';
import { createServer, Server } from 'http';
import { initDb } from '../src/db.js';
import documentsRouter from '../src/routes/documents.js';

let server: Server;
let baseUrl: string;

beforeAll(async () => {
  // Use in-memory DB for tests
  initDb(':memory:');

  const app = express();
  app.use(express.json());
  app.use('/api/documents', documentsRouter);

  server = createServer(app);
  await new Promise<void>((resolve) => {
    server.listen(0, () => resolve());
  });
  const addr = server.address() as { port: number };
  baseUrl = `http://localhost:${addr.port}`;
});

afterAll(() => {
  server?.close();
});

describe('Documents REST API', () => {
  let docId: string;

  it('POST /api/documents creates a document', async () => {
    const res = await fetch(`${baseUrl}/api/documents`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'Test Doc' }),
    });
    expect(res.status).toBe(201);
    const doc = await res.json();
    expect(doc.title).toBe('Test Doc');
    expect(doc.content).toBe('');
    expect(doc.version).toBe(1);
    expect(doc.id).toBeDefined();
    docId = doc.id;
  });

  it('GET /api/documents lists documents', async () => {
    const res = await fetch(`${baseUrl}/api/documents`);
    expect(res.status).toBe(200);
    const docs = await res.json();
    expect(docs.length).toBeGreaterThanOrEqual(1);
    expect(docs.find((d: any) => d.id === docId)).toBeDefined();
  });

  it('GET /api/documents/:id returns the document with content', async () => {
    const res = await fetch(`${baseUrl}/api/documents/${docId}`);
    expect(res.status).toBe(200);
    const doc = await res.json();
    expect(doc.id).toBe(docId);
    expect(doc.title).toBe('Test Doc');
    expect(doc.content).toBe('');
  });

  it('PUT /api/documents/:id updates content and version', async () => {
    const res = await fetch(`${baseUrl}/api/documents/${docId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: 'Hello world', version: 2 }),
    });
    expect(res.status).toBe(200);
    const doc = await res.json();
    expect(doc.content).toBe('Hello world');
    expect(doc.version).toBe(2);
  });

  it('DELETE /api/documents/:id deletes the document', async () => {
    const res = await fetch(`${baseUrl}/api/documents/${docId}`, {
      method: 'DELETE',
    });
    expect(res.status).toBe(204);

    const getRes = await fetch(`${baseUrl}/api/documents/${docId}`);
    expect(getRes.status).toBe(404);
  });

  it('GET /api/documents/:id returns 404 for nonexistent doc', async () => {
    const res = await fetch(`${baseUrl}/api/documents/nonexistent`);
    expect(res.status).toBe(404);
  });
});
