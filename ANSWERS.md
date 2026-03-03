# Submission Answers

---

## Submission Details

### Tech Stack Summary

- Backend: Node.js + TypeScript, Express, `ws` (raw WebSocket library), `better-sqlite3` for persistence
- Frontend: React 18 + TypeScript, Vite, react-router-dom
- Testing: Vitest
- IDs: `uuid` v4

### How to Test

1. Open the app at [URL]. You'll land on the Dashboard.
2. Click "New document" to create a document. You'll be taken to the editor.
3. Copy the URL from your browser and open it in a second tab (or a different browser).
4. Start typing in Tab 1. You should see the changes appear in Tab 2 within about a second, and vice versa.
5. The presence indicator in the top-right should show "2 editors" with two colored dots.
6. Close Tab 2. The presence count in Tab 1 should drop back to "1 editor."
7. Reopen the URL in a new tab. The full document content should still be there, loaded from the database.

---

## Part 2: Architecture & Debugging

### 1. Architecture Decisions

**System Architecture**

```
┌─────────────────────────────────────────────────────────────┐
│                        Browser (Tab)                        │
│                                                             │
│  ┌──────────────┐   ┌──────────────┐   ┌────────────────┐  │
│  │   Editor UI  │◄──│ useCollab    │──►│  REST Client   │  │
│  │  (textarea)  │   │ Socket hook  │   │  (fetch)       │  │
│  └──────────────┘   └──────┬───────┘   └───────┬────────┘  │
│                            │ WebSocket          │ HTTP      │
└────────────────────────────┼───────────────────┼───────────┘
                             │                    │
                    ┌────────▼────────────────────▼────────┐
                    │         Express Server (port 3001)    │
                    │                                       │
                    │  ┌─────────────┐  ┌───────────────┐  │
                    │  │  WS Server  │  │  REST API     │  │
                    │  │  /ws        │  │  /api/docs/*  │  │
                    │  └──────┬──────┘  └───────┬───────┘  │
                    │         │                  │          │
                    │  ┌──────▼──────┐          │          │
                    │  │   Rooms     │          │          │
                    │  │  (in-mem    │          │          │
                    │  │   Map)      │          │          │
                    │  └──────┬──────┘          │          │
                    │         │                  │          │
                    │  ┌──────▼──────────────────▼───────┐  │
                    │  │         SQLite (better-sqlite3)  │  │
                    │  │  documents: id, title, content,  │  │
                    │  │            version, timestamps   │  │
                    │  └─────────────────────────────────┘  │
                    └───────────────────────────────────────┘
```

The Express HTTP server and the WebSocket server share the same port. The HTTP server handles REST CRUD operations. The WebSocket server handles real-time sync and presence. Both read from and write to the same SQLite database.

**Message flow for a single keystroke (User A to User B):**

1. User A types a character. The React `onChange` fires immediately, updating local state (optimistic UI).
2. The `useCollabSocket` hook debounces for 300ms. If no more keystrokes come in during that window, it sends a `doc:update` message over the WebSocket:
   ```json
   { "type": "doc:update", "docId": "abc-123", "content": "full doc text", "version": 4 }
   ```
3. The server's `handleUpdate` function receives this. It reads the document from SQLite and checks the version. If the client's version (4) matches the DB version (4), the update is accepted.
4. The server increments the version to 5, writes the new content to SQLite, and broadcasts a `doc:sync` message to all other clients in the room:
   ```json
   { "type": "doc:sync", "docId": "abc-123", "content": "full doc text", "version": 5 }
   ```
5. The server also sends a `doc:sync` back to User A with the new version number, so the client knows its local version is now 5.
6. User B's WebSocket `onmessage` handler receives the `doc:sync`, updates the React state with the new content and version, and the textarea re-renders.

Total latency is roughly: 300ms debounce + network round trip + server processing. Under normal conditions, User B sees the change well within 1 second.

**Conflict handling strategy:**

I use Last-Write-Wins with version gating. Every document has a monotonically increasing `version` integer. When a client sends an update, it includes the version it currently knows about. The server only accepts the update if the client's version matches the server's version. If it doesn't match, the server rejects the update and sends the client the current content and version so it can rebase.

Here's what happens when User A and User B both edit within the same 200ms window:

1. Both users have the document at version 4. Both type something.
2. After the 300ms debounce, both clients send `doc:update` with `version: 4`.
3. One message arrives at the server first. Let's say User A's arrives first. The server sees version 4 matches, accepts it, increments to version 5, writes to DB, and broadcasts the sync.
4. User B's message arrives next. The server sees the client sent version 4, but the DB is now at version 5. The versions don't match, so the server rejects B's update and sends back a `doc:sync` with the current content (A's edit) at version 5.
5. User B's client receives the sync and updates its local state. User B's edit is effectively overwritten by A's edit.

This is the core limitation: the losing client's edit gets replaced. In practice, the 300ms debounce helps a lot because it batches keystrokes, and conflicts only happen when two people submit in the same narrow window between debounce cycles.

For a production system with heavy concurrent editing, I would move to an Operational Transformation (OT) approach or a CRDT like Yjs. OT transforms conflicting operations against each other so both edits can be preserved (e.g., if A inserts at position 5 and B inserts at position 10, both operations can be applied by adjusting offsets). CRDTs go further and make the document structure itself conflict-free. Either approach is significantly more complex to implement but eliminates the "last write stomps on the other" problem entirely.

**WebSocket disconnection handling:**

The sequence when a connection drops:

1. The browser's WebSocket fires `onclose`. The hook sets `connectionStatus` to `'disconnected'`, which renders a "Reconnecting" banner in the PresenceBar.
2. The hook starts an exponential backoff timer: first retry at 1 second, then 2s, 4s, 8s, capped at 10s.
3. If the user keeps typing while disconnected, the debounce timer still fires. When it sees the WebSocket isn't open, it stores the latest content in `pendingContentRef` (a buffer).
4. On the server side, the `close` event fires for the old socket. The server removes the client from its room and broadcasts an updated presence count to the remaining clients.
5. When the backoff timer fires, the client creates a new WebSocket. On successful `onopen`, it resets the backoff delay to 1s, sends `doc:join` to rejoin the room, and if there's a pending edit in the buffer, it immediately sends that as a `doc:update`.
6. The server responds with a `doc:sync` containing the latest content and version, which reconciles the client's state.

In addition to the WebSocket reconnection, the client also fetches the latest document state via the REST API on initial mount. This means even if the WebSocket handshake takes a moment, the user sees the most recent content from the database right away.

What could be lost: if the user types while disconnected and closes the tab before the reconnection happens, those buffered edits are gone (they only live in memory). The debounce also means there's always up to 300ms of unsubmitted keystrokes at risk. To reduce this risk, you could persist the pending buffer to `localStorage`, or send edits more aggressively (shorter debounce) when the connection is healthy.

---

### 2. Production Debugging Scenario

**Root causes, ranked by likelihood:**

**1. (Most likely) WebSocket connections are not being properly cleaned up after the database migration, causing a connection/memory leak that leads to write failures.**

The Thursday database migration is the most suspicious change. If the migration introduced any latency or brief connectivity issues between the app server and the new database instance, it could have caused WebSocket message handlers to fail silently when trying to persist updates. If `updateDocument` throws an error that isn't caught (or returns undefined due to a connection hiccup), the client would see their edit locally (optimistic UI) and assume it was saved, but it never made it to the database. That explains Symptom 1: users saw their edits on screen, but the edits were never persisted.

The connection spike (Symptom 3) could be caused by the new database instance having slightly different connection handling. If DB queries occasionally hang or timeout, the WebSocket handler could stall, causing clients to think the connection is dead and reconnect. Each reconnection creates a new socket, but if the old ones aren't being cleaned up properly (maybe the close event doesn't fire cleanly when the server is under load), you get leaked connections and steadily growing memory.

Symptom 2 (the flicker) makes sense too: the client fetches the document via REST on mount (which returns the DB state), then the WebSocket join sends back a `doc:sync` with whatever version is in the DB. If there's a caching layer or read replica involved in the new database setup, the REST call and the WS handler might briefly read different versions.

**2. (Likely) A bug in the room cleanup logic causes zombie WebSocket connections to accumulate.**

If `leaveAllRooms` doesn't get called reliably on disconnect (for example, if the socket enters a half-open state where the server doesn't detect the close), connections pile up in the rooms Map without being removed. This directly explains Symptom 3 (3x connection counts, climbing memory). It could also explain Symptom 1 indirectly: if the rooms Map grows very large, iterating over it in `leaveAllRooms` gets slower, which could cause the Node.js event loop to block, leading to dropped messages and failed persists.

**3. (Possible) The optimistic UI is masking failed writes, and the 300ms debounce means some final edits before closing are never sent.**

When a user types and immediately closes their laptop, the debounce timer may not have fired yet, meaning the last edit was never sent over the WebSocket at all. This could account for Symptom 1 on its own, though it wouldn't be new behavior, so it's less likely to explain a spike in complaints specifically after the Thursday migration. Still worth investigating since it might be a contributing factor that compounds with the other issues.

**Investigation plan for Hypothesis 1:**

First, I'd check database connectivity from the app server:

- Look at the app server logs around Friday afternoon for any database errors, timeouts, or connection pool exhaustion messages. Search for unhandled promise rejections or uncaught exceptions.
- Run `SELECT count(*) FROM documents WHERE updated_at > '2024-XX-XX 12:00:00'` on the database to see if writes actually dropped off on Friday afternoon compared to normal patterns.
- Check the database migration logs from Thursday. Did the connection string change? Is there a read replica that the REST API might be hitting while the WS handler writes to primary?
- On the server, check the Node.js process memory profile: `process.memoryUsage()` over time, or look at the monitoring dashboards for heap size. If it's growing linearly, that's a leak.
- Check the WebSocket server's connection count vs. the rooms Map size. If the rooms Map has way more entries than active connections, connections aren't being cleaned up.
- Look at the `ws` library's `clients` set size over time. Compare it to the rooms Map total across all rooms. If they diverge, close events are being missed.

**Short-term mitigation (today):**

- Add a heartbeat/ping-pong to the WebSocket server. Every 30 seconds, the server pings all clients. If a client doesn't respond within 10 seconds, force-close that socket. This will clean up zombie connections immediately and stop the memory bleed.
- For the users who lost edits: check if the database has any WAL (Write-Ahead Log) entries or backups from Friday that could be recovered.
- If DB query latency is the culprit, add a try/catch around the `updateDocument` call in the WS handler and send a `doc:error` back to the client if it fails. At least users will know their edit didn't save.

**Long-term fix:**

- Wrap all database calls in the WebSocket handler with proper error handling. If a write fails, send the client an explicit error message so the optimistic UI can surface it.
- Implement server-side heartbeat/ping-pong as a permanent feature. The `ws` library supports this natively. Terminate connections that don't respond.
- Add a `beforeunload` handler on the client side that does a synchronous `navigator.sendBeacon` POST to a REST endpoint, flushing any pending edits before the tab closes. This addresses the debounce window problem.
- Consider adding write acknowledgments: the server should explicitly confirm that a write was persisted to DB, separate from the sync broadcast. If the client doesn't receive an ack within a timeout, it retries.

**Monitoring to add:**

- Alert on WebSocket connection count exceeding 2x the rolling average for that time of day.
- Alert on server memory usage exceeding a threshold (e.g., 512MB) or growing more than 20% in a 24-hour period.
- Track and graph the ratio of `doc:update` messages received vs. successful DB writes. If they diverge, something is swallowing writes.
- Add structured logging for every DB write with the document ID, version, and success/failure status.
- Monitor Node.js event loop lag. If it exceeds 100ms, that's a sign of blocking operations or resource exhaustion.

---

## Part 3: Reflection

### 3. Build Process & LLM Usage

**Build process:**

I started with the database layer and REST API. Getting CRUD working end-to-end gave me a stable foundation to build on and something I could test quickly with curl. Once the REST layer was solid, I moved to the WebSocket server. I built the room management module (`rooms.ts`) first as a standalone concern, then wired up the message handler (`handler.ts`) on top of it. The room abstraction made it easy to think about join/leave/broadcast without getting tangled up in the WebSocket lifecycle details.

For the real-time sync, my strategy was to keep things simple and get a working version first. I went with full-document replacement on every update (the client sends the entire document content, not a diff or operation). This is definitely not how you'd do it in production at scale, but it sidesteps the complexity of operational transforms entirely and is totally fine for a prototype. The version gating on top gives us enough protection against conflicts that we won't silently lose data.

After the server was done, I built the React frontend. I wrote the `useCollabSocket` hook first since it's the core integration point, then built the UI around it. The hook encapsulates all the WebSocket lifecycle, reconnection, debouncing, and buffering logic, so the actual page components stay clean and just consume `{ content, setContent, users, connectionStatus }`.

Tests came last. I wrote them against the actual server code using in-memory SQLite databases, so they're true integration tests, not mocks.

**Where AI tools helped the most:**

The boilerplate and wiring code was where AI saved the most time. Setting up the Express server, TypeScript configs, Vite proxy configuration, the SQLite migration, the REST routes. All of that is stuff I could write from memory but it takes time to get all the details right (the correct `tsconfig` options for ESM, the right Express 5 types, etc). Having AI generate the initial scaffold let me spend my time on the parts that actually matter: the WebSocket protocol design and the client-side sync logic.

**Where AI struggled:**

The Express 5 type definitions were a concrete issue. The generated route handlers used `req.params.id` directly, but the newer `@types/express` v5 types define params values as `string | string[]`, which broke TypeScript's strict mode. The AI's initial code didn't account for this. I had to go back and add explicit `as string` casts on every `req.params.id` usage. It was a small fix but it's the kind of thing that would trip someone up if they just accepted the output without running `tsc`.

**WebSocket issues:**

The reconnection logic needed careful attention. The tricky part is the interaction between the React component lifecycle and the WebSocket lifecycle. The `useCollabSocket` hook uses refs (`versionRef`, `pendingContentRef`) alongside React state to avoid stale closures in the WebSocket callbacks. If you just used the state values directly inside `ws.onmessage` or `ws.onopen`, you'd capture stale versions from the initial render. The ref pattern solves this, but it's easy to miss, and an LLM generating this kind of code won't always get the ref/state boundary right.

Another subtlety: the cleanup function in the `useEffect` needs to close the WebSocket and clear both the reconnect timer and the debounce timer. If you miss the debounce cleanup, you can get a timer firing after the component unmounts that tries to call `send` on a closed socket. The generated code had all the cleanup in place, but I verified it carefully because this is exactly the kind of thing that works fine in happy-path testing and then causes intermittent errors in production.

**What I'd improve with another day:**

The biggest thing I'd add is cursor position sharing. Right now, both users can see each other's content changes, but they can't see where the other person is typing. Adding cursor/selection indicators would make the collaboration feel much more alive. The implementation would involve sending cursor position (start/end offsets) alongside the regular content updates, and rendering colored highlights on the textarea (or switching to a contenteditable div with a custom rendering layer).

Beyond that, I'd replace the full-document replacement model with an operation-based approach. Sending the entire document content on every keystroke is wasteful for large documents. Even a simple diff-based approach (send only the changed portion with offset and length) would reduce bandwidth significantly and make conflict handling more granular. If I really wanted production-grade collaboration, I'd integrate Yjs, which gives you a CRDT-backed document model with cursor awareness built in.
