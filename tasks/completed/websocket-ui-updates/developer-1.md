# Developer Report

## Task
Replace the 2-second polling mechanism in the Chorus UI with a WebSocket connection to the backend. The backend broadcasts state updates to all connected WebSocket clients whenever data changes, and the UI receives these updates in real time.

## Files Modified
- `packages/chorus/src/Main.gren` - Added WebSocket server: imports (WebSocketServer, WebSocketServer.Connection), model fields (websocketServer, websocketClients), initialization via Init.await + createServer on port+1, message handlers (GotWebSocketServer, WsClientConnected, WsClientDisconnected, WsClientError, WsBroadcastResult), subscriptions (onConnection, onClose, onError), broadcast helper function, broadcast calls after all mutating API operations, and a new GotMutatingApiResult msg variant for route-level mutations
- `packages/chorus-ui/src/Main.gren` - Added WebSocket client: imports (WebSocket, WebSocket.Connection, Process), WebSocketConnectionState custom type (WsNotConnected | WsConnecting | WsConnected | WsReconnecting), model fields (websocketConnection, websocketUrl), derived WebSocket URL from page URL in init, connect on workspace config load, message handlers (GotWsConnection, GotWsMessage, GotWsClosed, GotWsError, WsReconnect), JSON message decoding and data refresh, reconnection with 3-second delay, removed Poll/lastPoll and replaced with Tick/currentTime at 10-second intervals for notification expiry

## Build Status
**Status:** PASS

```
Success! Compiled 13 modules. (chorus-ui)
Success! Compiled 22 modules. (chorus)
dist/ assembled.
```

## Test Status
**Status:** PASS

```
Running 68 tests...
68 passed, 0 failed

Running 19 integration tests...
19 passed, 0 failed
```

## Implementation Notes

### Backend WebSocket Server
- The WebSocket server runs on HTTP port + 1 (e.g., if HTTP is 8080, WebSocket is 8081), matching the plan's specification
- WebSocketServer.initialize is added to the Init.await chain alongside HttpServer.initialize
- Client connections are tracked in a `Dict Int WebSocketServer.Connection` keyed by connectionIdToInt
- The `broadcastToClients` helper sends to all connected clients individually; errors on individual connections are caught via WsBroadcastResult (fire-and-forget)

### Broadcast Strategy
- For HTTP mutation routes (status updates, planning edits, agent/provider CRUD, etc.), a `GotMutatingApiResult` msg variant carries a `broadcastType` string alongside the response, so the handler can broadcast after sending the HTTP response
- A `mutatingToMsg` helper in handleRoute constructs these messages for mutation routes while `toMsg` remains for read-only routes
- For internal mutations (agent completion, planner completion), `GotInternalApiResult` now broadcasts "tasks_changed" since all internal API results are task mutations
- The broadcast message is JSON: `{"type": "tasks_changed", "data": "<api response body>"}` where data is the API response body string (or null for internal mutations)

### UI WebSocket Client
- `WebSocketConnectionState` is a custom type following the "make invalid states unrepresentable" coding standard
- The WebSocket URL is derived from `window.location` at init time: `ws://<host>:<httpPort+1>`
- Connection is initiated when workspace config is loaded (GotInitialConfig/GotConfig)
- On receiving a message, the UI decodes the `type` field and re-fetches relevant data for the current page (e.g., "tasks_changed" re-fetches tasks/history for BoardPage or TaskDetailPage)
- Reconnection uses `Process.sleep 3000` for a 3-second delay before retrying
- `Poll Time.Posix` was replaced with `Tick Time.Posix` at 10-second intervals (only for notification expiry and time display)
- `lastPoll` was replaced with `currentTime` in the model and all references

### Gren-specific Adaptations
- Custom type variants with multiple parameters were converted to use records (Gren limitation of max 1 parameter per variant)
- Msg variants were renamed to avoid name clashes with the WebSocketConnectionState type (e.g., `WsConnected` msg became `GotWsConnection`)

## Iteration
1
