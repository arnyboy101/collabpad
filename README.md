# CollabPad

A real-time collaborative notes app. Multiple users can open the same document in different browser tabs and see each other's changes live via WebSockets.

**Live app:** https://collabpad--arnavsam.replit.app

**Source code:** https://github.com/arnyboy101/collabpad

## Tech Stack

- **Backend**: Node.js + TypeScript, Express, `ws` (raw WebSocket library)
- **Frontend**: React + TypeScript (Vite)
- **Database**: SQLite via `better-sqlite3`
- **Testing**: Vitest

## Getting Started

### Install dependencies

```bash
cd server && npm install
cd ../client && npm install
```

### Development

Run server and client in separate terminals:

```bash
# Terminal 1 — Server (port 3001)
cd server && npm run dev

# Terminal 2 — Client (port 5173, proxies API/WS to server)
cd client && npm run dev
```

Open http://localhost:5173

### Production Build

```bash
# From the collabpad/ root
npm run build   # Builds client and copies to server/public
npm start       # Starts server serving both API and static files
```

### Run Tests

```bash
cd server && npm test
```

## Architecture

### REST API

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/documents` | List all documents |
| POST | `/api/documents` | Create new document |
| GET | `/api/documents/:id` | Get document with content |
| PUT | `/api/documents/:id` | Update document |
| DELETE | `/api/documents/:id` | Delete document |

### WebSocket Protocol

Connect to `/ws` and send JSON messages:

- `doc:join { docId }` — Join a document room
- `doc:update { docId, content, version }` — Send an edit
- `doc:sync { docId, content, version }` — Server broadcasts updates
- `presence:update { docId, users }` — Server broadcasts user count
- `doc:error { message }` — Server sends error

### Conflict Handling

Last-Write-Wins with version gating:
- Each document has a monotonically increasing `version`
- Client sends its known version with each update
- If client version matches server version: accept, increment, broadcast
- If stale: server sends current state for client to rebase
- Client-side edits are debounced (300ms) to reduce conflict frequency

### Connection Resilience

- Detects WebSocket disconnection and shows "Reconnecting..." banner
- Exponential backoff reconnect (1s → 2s → 4s → max 10s)
- On reconnect: fetches latest state via REST, re-joins WS room
- Buffers local edits made while disconnected for replay after reconnect
