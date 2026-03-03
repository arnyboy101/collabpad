export interface Document {
  id: string;
  title: string;
  content: string;
  version: number;
  created_at: string;
  updated_at: string;
}

export interface DocumentSummary {
  id: string;
  title: string;
  updated_at: string;
}

export type ConnectionStatus = 'connecting' | 'connected' | 'disconnected';

export type WSMessage =
  | { type: 'doc:join'; docId: string }
  | { type: 'doc:update'; docId: string; content: string; version: number }
  | { type: 'doc:sync'; docId: string; content: string; version: number }
  | { type: 'presence:update'; docId: string; users: number }
  | { type: 'doc:error'; message: string };
