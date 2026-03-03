import { WebSocket } from 'ws';
import { WSMessage } from '../types.js';
import { getDocument, updateDocument } from '../db.js';
import {
  joinRoom,
  leaveAllRooms,
  getRoomSize,
  broadcastToRoom,
} from './rooms.js';

function send(ws: WebSocket, msg: WSMessage): void {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(msg));
  }
}

function broadcastPresence(docId: string): void {
  const users = getRoomSize(docId);
  broadcastToRoom(
    docId,
    JSON.stringify({ type: 'presence:update', docId, users })
  );
}

export function handleConnection(ws: WebSocket): void {
  ws.on('message', (raw) => {
    let msg: WSMessage;
    try {
      msg = JSON.parse(raw.toString());
    } catch {
      send(ws, { type: 'doc:error', message: 'Invalid JSON' });
      return;
    }

    switch (msg.type) {
      case 'doc:join':
        handleJoin(ws, msg.docId);
        break;
      case 'doc:update':
        handleUpdate(ws, msg.docId, msg.content, msg.version);
        break;
      default:
        send(ws, { type: 'doc:error', message: `Unknown message type` });
    }
  });

  ws.on('close', () => {
    const leftRooms = leaveAllRooms(ws);
    for (const docId of leftRooms) {
      broadcastPresence(docId);
    }
  });
}

function handleJoin(ws: WebSocket, docId: string): void {
  const doc = getDocument(docId);
  if (!doc) {
    send(ws, { type: 'doc:error', message: 'Document not found' });
    return;
  }

  joinRoom(docId, ws);

  // Send current doc state to the joining client
  send(ws, {
    type: 'doc:sync',
    docId,
    content: doc.content,
    version: doc.version,
  });

  // Broadcast updated presence to all clients in room
  broadcastPresence(docId);
}

function handleUpdate(
  ws: WebSocket,
  docId: string,
  content: string,
  clientVersion: number
): void {
  const doc = getDocument(docId);
  if (!doc) {
    send(ws, { type: 'doc:error', message: 'Document not found' });
    return;
  }

  // Version check: client must have the current version
  if (clientVersion !== doc.version) {
    // Client is stale — send them the current state to rebase
    send(ws, {
      type: 'doc:sync',
      docId,
      content: doc.content,
      version: doc.version,
    });
    return;
  }

  // Accept the update: increment version, persist
  const newVersion = doc.version + 1;
  updateDocument(docId, content, newVersion);

  // Broadcast the update to all OTHER clients in the room
  broadcastToRoom(
    docId,
    JSON.stringify({
      type: 'doc:sync',
      docId,
      content,
      version: newVersion,
    }),
    ws // exclude sender
  );

  // Confirm to sender with the new version
  send(ws, {
    type: 'doc:sync',
    docId,
    content,
    version: newVersion,
  });
}
