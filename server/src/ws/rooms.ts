import { WebSocket } from 'ws';

// Map of docId -> Set of connected WebSocket clients
const rooms = new Map<string, Set<WebSocket>>();

export function joinRoom(docId: string, ws: WebSocket): void {
  if (!rooms.has(docId)) {
    rooms.set(docId, new Set());
  }
  rooms.get(docId)!.add(ws);
}

export function leaveRoom(docId: string, ws: WebSocket): void {
  const room = rooms.get(docId);
  if (room) {
    room.delete(ws);
    if (room.size === 0) {
      rooms.delete(docId);
    }
  }
}

export function leaveAllRooms(ws: WebSocket): string[] {
  const leftRooms: string[] = [];
  for (const [docId, room] of rooms) {
    if (room.has(ws)) {
      room.delete(ws);
      leftRooms.push(docId);
      if (room.size === 0) {
        rooms.delete(docId);
      }
    }
  }
  return leftRooms;
}

export function getRoomSize(docId: string): number {
  return rooms.get(docId)?.size ?? 0;
}

export function broadcastToRoom(docId: string, message: string, exclude?: WebSocket): void {
  const room = rooms.get(docId);
  if (!room) return;
  for (const client of room) {
    if (client !== exclude && client.readyState === WebSocket.OPEN) {
      client.send(message);
    }
  }
}
