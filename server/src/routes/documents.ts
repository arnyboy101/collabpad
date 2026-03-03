import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import {
  getAllDocuments,
  getDocument,
  createDocument,
  updateDocument,
  updateDocumentTitle,
  deleteDocument,
} from '../db.js';

const router = Router();

// GET /api/documents — list all docs
router.get('/', (_req: Request, res: Response) => {
  const docs = getAllDocuments();
  res.json(docs);
});

// POST /api/documents — create new doc
router.post('/', (req: Request, res: Response) => {
  const { title } = req.body;
  const id = uuidv4();
  const doc = createDocument(id, title || 'Untitled');
  res.status(201).json(doc);
});

// GET /api/documents/:id — get single doc
router.get('/:id', (req: Request, res: Response) => {
  const id = req.params.id as string;
  const doc = getDocument(id);
  if (!doc) {
    res.status(404).json({ error: 'Document not found' });
    return;
  }
  res.json(doc);
});

// PUT /api/documents/:id — update doc
router.put('/:id', (req: Request, res: Response) => {
  const id = req.params.id as string;
  const { content, title, version } = req.body;
  const existing = getDocument(id);
  if (!existing) {
    res.status(404).json({ error: 'Document not found' });
    return;
  }

  if (title !== undefined) {
    updateDocumentTitle(id, title);
  }

  if (content !== undefined && version !== undefined) {
    const updated = updateDocument(id, content, version);
    res.json(updated);
    return;
  }

  const doc = getDocument(id);
  res.json(doc);
});

// DELETE /api/documents/:id — delete doc
router.delete('/:id', (req: Request, res: Response) => {
  const id = req.params.id as string;
  const deleted = deleteDocument(id);
  if (!deleted) {
    res.status(404).json({ error: 'Document not found' });
    return;
  }
  res.status(204).send();
});

export default router;
