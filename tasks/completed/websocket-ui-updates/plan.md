# Replace polling with WebSocket-based real-time updates

## Summary
Replace the 2-second polling mechanism in the Chorus UI with a WebSocket connection to the backend. The backend will broadcast state updates to all connected WebSocket clients whenever data changes, and the UI will receive these updates in real time instead of periodically re-fetching all data via HTTP.

## Requirements
1. **Backend: WebSocket server** -- Add a WebSocket server (on a separate port from the HTTP server) to the Chorus backend. Initialize `WebSocketServer` permission in `init`, create the server, and track connected clients.
2. **Backend: Connection management** -- Track connected WebSocket clients in the `Model` using a `Dict Int WebSocketServer.Connection`. Subscribe to `onConnection`, `onClose`, and `onError` events.
3. **Backend: Broadcast on state changes** -- After every mutating API operation (create task, update status, planning updates, agent start/complete, handoff, config changes, agent/provider CRUD, etc.), broadcast a JSON notification message to all connected WebSocket clients. The message should identify the type of change (e.g., `"task_updated"`, `"tasks_changed"`, `"agents_changed"`, `"providers_changed"`, `"config_changed"`) and include the updated entity payload so the UI does not need to re-fetch.
4. **UI: WebSocket client connection** -- On `init` (after workspace config is loaded), open a WebSocket connection to the backend using `WebSocket.connect`. Store the connection in the `Model`.
5. **UI: Handle incoming messages** -- Subscribe to `WebSocket.onMessage` and decode incoming JSON messages. Update the model directly with the received data (tasks, agents, providers, history, etc.) based on message type.
6. **UI: Reconnection on close/error** -- If the WebSocket connection is closed or errors out, attempt to reconnect after a short delay. Track connection status in the model.
7. **UI: Remove polling** -- Remove the `Time.every 2000 Poll` subscription and the `Poll` message handler from the UI. Remove the `lastPoll` field from the model (note: this field is also used as `now` for notification expiry and time display, so it needs to be replaced with a separate `currentTime` field updated via a lower-frequency timer or WebSocket heartbeat).
8. **UI: Keep HTTP for user-initiated actions** -- All existing HTTP API calls for mutations (create task, update status, etc.) remain as-is. Only the polling-based reads are replaced by WebSocket push.

## Acceptance Criteria
- [ ] Backend starts a WebSocket server alongside the HTTP server
- [ ] Backend tracks connected WebSocket clients
- [ ] Backend broadcasts JSON update messages to all clients on every state mutation
- [ ] UI connects to the WebSocket server on startup
- [ ] UI receives and processes real-time update messages (tasks, agents, providers, config)
- [ ] UI reconnects automatically if the WebSocket connection is lost
- [ ] The 2-second polling `Time.every 2000 Poll` subscription is removed
- [ ] The `Poll` message handler is removed from the UI update function
- [ ] User-initiated HTTP API calls (create, update, delete) still work correctly
- [ ] Application builds successfully (`npm run build:all`)
- [ ] The UI reflects state changes in real time without manual refresh

## Out of Scope
- Authentication/authorization on the WebSocket connection
- Per-client filtering of messages (all clients get all updates)
- Binary WebSocket messages (text JSON only)
- WebSocket support for the agent tool API (agents still use HTTP)

## Technical Context

### Files to Modify

**Backend (packages/chorus/):**
- `src/Main.gren` -- Add `WebSocketServer` imports, add `websocketServer` and `websocketClients` fields to `Model`, initialize WebSocket server in `init`, add WebSocket subscription handlers (`WsClientConnected`, `WsClientDisconnected`, `WsClientError`), add broadcast helper function, call broadcast after every mutating API result handler
- `src/Web/Server.gren` -- May need a new `createWebSocketServer` wrapper (or extend the existing module) if we want a clean abstraction, though this can also be done directly in Main

**UI (packages/chorus-ui/):**
- `src/Main.gren` -- Add `WebSocket` imports, add `websocketConnection` field to `Model` (as a custom type: `NotConnected | Connecting | Connected WebSocket.Connection | Reconnecting`), add messages for WebSocket events (`WsConnected`, `WsMessage`, `WsClosed`, `WsError`, `WsReconnect`), decode incoming messages and update model, remove `Poll` and `lastPoll`, add `currentTime` field with a low-frequency timer for notification expiry, update `subscriptions` to use `WebSocket.onMessage`/`onClose`/`onError` instead of `Time.every 2000 Poll`

**Shared (packages/shared/):**
- `Types.gren` -- Add encoder functions for the broadcast message format if not already present (the existing encoders for tasks, agents, providers, etc. should be usable)

### Related Files (reference only)
- `/Users/david/dev/gren-lang/node/src/WebSocketServer.gren` -- Server-side WebSocket API (createServer, onConnection, onMessage, onClose, onError)
- `/Users/david/dev/gren-lang/node/src/WebSocketServer/Connection.gren` -- Server-side send/close API
- `/Users/david/dev/gren-lang/browser/src/WebSocket.gren` -- Client-side WebSocket API (connect, onMessage, onClose, onError)
- `/Users/david/dev/gren-lang/browser/src/WebSocket/Connection.gren` -- Client-side send/close API
- `packages/chorus-ui/src/Api.gren` -- Existing HTTP API client (kept for mutations)

### Patterns to Follow
- WebSocket server initialization follows the same `Init.await` pattern as `HttpServer.initialize` in `Main.gren`
- Connection tracking should use `Dict Int WebSocketServer.Connection` keyed by `connectionIdToInt`
- Broadcast is a `Cmd` that sends to all connections using `WebSocketServer.Connection.send` chained with `Task.andThen`, with errors logged but not propagated (fire-and-forget for broadcasts)
- UI WebSocket connection state should follow the "make invalid states unrepresentable" coding standard -- use a custom type, not separate boolean flags
- The broadcast message format should be a JSON object: `{ "type": "tasks_changed", "data": ... }` matching the existing API response format so the UI can reuse its existing decoders

### WebSocket Port
The WebSocket server should run on a separate port from the HTTP server. Use the HTTP server port + 1 (e.g., if HTTP is on 8080, WebSocket is on 8081). This avoids needing to share the HTTP server's connection upgrade mechanism and keeps the implementation simple. The UI can derive the WebSocket URL from `window.location`.

## Testing Requirements
- Build succeeds: `npm run build:all`
- Manual test: Start the app, open two browser tabs, perform mutations in one tab and verify the other tab updates in real time
- Manual test: Kill and restart the server, verify the UI reconnects automatically
- Existing tests continue to pass: `npm run test`

## Notes
- The local `gren-lang/node` package (referenced via `local:../../../gren-lang/node` in `gren.json`) already exposes `WebSocketServer` and `WebSocketServer.Connection`
- The local `gren-lang/browser` package (referenced via `local:../../../gren-lang/browser` in `gren.json`) already exposes `WebSocket` and `WebSocket.Connection`
- The `WebSocketServer.createServer` takes `{ host, port_ }` just like `HttpServer.createServer`
- The `WebSocket.connect` takes a URL string like `"ws://localhost:8081"` and returns a `Result ConnectError Connection` via a message
- On the server side, `WebSocketServer.Connection.send` returns a `Task Error {}` -- for broadcast, errors on individual connections should be caught and the connection removed from the tracking dict
- The UI's `currentTime` replacement for `lastPoll` could be a `Time.every 60000` (once per minute) subscription, since it is only used for notification expiry display, not for data freshness
- The `loadPageData` function in the UI should still be called on page navigation to do an initial HTTP fetch, since the WebSocket may not have sent the relevant data yet. Once the initial load is done, subsequent updates come via WebSocket.
