import { useEffect, useRef, useState, useCallback } from 'react';
import { ConnectionStatus, WSMessage } from '../types';

const WS_URL =
  typeof window !== 'undefined'
    ? `${window.location.protocol === 'https:' ? 'wss' : 'ws'}://${window.location.host}/ws`
    : 'ws://localhost:3001/ws';

interface UseCollabSocketReturn {
  content: string;
  setContent: (content: string) => void;
  users: number;
  connectionStatus: ConnectionStatus;
  version: number;
}

export function useCollabSocket(docId: string): UseCollabSocketReturn {
  const [content, setContentState] = useState('');
  const [users, setUsers] = useState(0);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('connecting');
  const [version, setVersion] = useState(1);

  const wsRef = useRef<WebSocket | null>(null);
  const versionRef = useRef(1);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout>>();
  const debounceTimeoutRef = useRef<ReturnType<typeof setTimeout>>();
  const pendingContentRef = useRef<string | null>(null);
  const reconnectDelayRef = useRef(1000);

  // Keep versionRef in sync
  useEffect(() => {
    versionRef.current = version;
  }, [version]);

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return;

    setConnectionStatus('connecting');
    const ws = new WebSocket(WS_URL);
    wsRef.current = ws;

    ws.onopen = () => {
      setConnectionStatus('connected');
      reconnectDelayRef.current = 1000; // Reset backoff

      // Join the document room
      ws.send(JSON.stringify({ type: 'doc:join', docId }));

      // Replay any buffered edit
      if (pendingContentRef.current !== null) {
        ws.send(
          JSON.stringify({
            type: 'doc:update',
            docId,
            content: pendingContentRef.current,
            version: versionRef.current,
          })
        );
        pendingContentRef.current = null;
      }
    };

    ws.onmessage = (event) => {
      let msg: WSMessage;
      try {
        msg = JSON.parse(event.data);
      } catch {
        return;
      }

      switch (msg.type) {
        case 'doc:sync':
          setContentState(msg.content);
          setVersion(msg.version);
          versionRef.current = msg.version;
          break;
        case 'presence:update':
          setUsers(msg.users);
          break;
        case 'doc:error':
          console.error('WS error:', msg.message);
          break;
      }
    };

    ws.onclose = () => {
      setConnectionStatus('disconnected');
      // Exponential backoff reconnect
      const delay = Math.min(reconnectDelayRef.current, 10000);
      reconnectTimeoutRef.current = setTimeout(() => {
        reconnectDelayRef.current = delay * 2;
        connect();
      }, delay);
    };

    ws.onerror = () => {
      ws.close();
    };
  }, [docId]);

  useEffect(() => {
    // Fetch latest state via REST on mount (source of truth)
    fetch(`/api/documents/${docId}`)
      .then((res) => res.json())
      .then((doc) => {
        setContentState(doc.content);
        setVersion(doc.version);
        versionRef.current = doc.version;
      })
      .catch(console.error);

    connect();

    return () => {
      clearTimeout(reconnectTimeoutRef.current);
      clearTimeout(debounceTimeoutRef.current);
      wsRef.current?.close();
      wsRef.current = null;
    };
  }, [docId, connect]);

  // setContent: apply locally (optimistic) + debounce WS send
  const setContent = useCallback(
    (newContent: string) => {
      setContentState(newContent);

      clearTimeout(debounceTimeoutRef.current);
      debounceTimeoutRef.current = setTimeout(() => {
        const ws = wsRef.current;
        if (ws && ws.readyState === WebSocket.OPEN) {
          ws.send(
            JSON.stringify({
              type: 'doc:update',
              docId,
              content: newContent,
              version: versionRef.current,
            })
          );
        } else {
          // Buffer for reconnect
          pendingContentRef.current = newContent;
        }
      }, 300);
    },
    [docId]
  );

  return { content, setContent, users, connectionStatus, version };
}
