# Code Review Report

## Summary
The implementation correctly replaces HTTP polling with WebSocket-based real-time updates. The backend adds a WebSocket server with connection tracking and broadcasting, and the UI connects, handles messages, and reconnects on failure. The code compiles, all 87 tests pass, and the architecture matches the plan. There are two blocking issues (misleading comments and an unused import) and several suggestions for improvement.

## Issues Found

### BLOCKING Issues

#### Issue 1: Misleading doc comment and inline comment on broadcast error handling
- **File:** `packages/chorus/src/Main.gren`
- **Line:** 2521-2526 (doc comment on `broadcastToClients`) and 1733 (inline comment on `WsBroadcastResult`)
- **Category:** Correctness
- **Description:** The doc comment on `broadcastToClients` states "Errors on individual connections are caught and the connection is removed from the tracking dict" but this does not happen. The `WsBroadcastResult` handler on line 1732 wildcards the entire result and does nothing -- it does not remove the failed connection, and it does not log the error. Similarly, the inline comment on line 1733 says "errors are logged elsewhere" but broadcast errors are not logged anywhere. These comments describe behavior that does not exist, which will mislead future maintainers.
- **Suggestion:** Fix the comments to accurately describe what happens. The `broadcastToClients` doc comment should say something like "Errors on individual connections are ignored; stale connections are cleaned up by the onClose/onError subscriptions." The `WsBroadcastResult` inline comment should say "Fire-and-forget; stale connections are cleaned up via WsClientDisconnected/WsClientError." Alternatively, actually implement error logging and connection removal in `WsBroadcastResult` (which would require adding the connection ID to the message variant).

#### Issue 2: Unused import `WebSocket.Connection as WsConnection` in UI
- **File:** `packages/chorus-ui/src/Main.gren`
- **Line:** 41
- **Category:** Style
- **Description:** The import `import WebSocket.Connection as WsConnection` is added but never used anywhere in the UI code. The `WsConnection` alias does not appear in any expression or type annotation in the file. Gren may not warn about unused imports, but dead imports add noise and suggest incomplete work or copy-paste from the backend.
- **Suggestion:** Remove the line `import WebSocket.Connection as WsConnection`.

### Suggestions

#### Suggestion 1: Stale module doc comment in UI
- **File:** `packages/chorus-ui/src/Main.gren`
- **Line:** 12
- **Category:** Naming
- **Description:** The module doc comment on line 12 says "- Automatic polling for updates" but polling has been removed and replaced with WebSocket-based real-time updates.
- **Suggestion:** Update to "- Real-time updates via WebSocket" or similar.

#### Suggestion 2: Duplicated broadcast-on-success pattern
- **File:** `packages/chorus/src/Main.gren`
- **Line:** 1311-1319 (`GotTaskCreated`), 882 (`GotHandoffRecorded`), 1294 (`GotToolResult` success branch)
- **Category:** Duplication
- **Description:** The pattern of "if ApiSuccess, broadcast with body; otherwise Cmd.none" is repeated in `GotTaskCreated`, `GotMutatingApiResult`, and several other handlers. The `GotMutatingApiResult` handler already encapsulates this pattern cleanly for the route-level mutations, but the special-purpose handlers (`GotTaskCreated`, `GotPlanTaskResult`, `GotAnswersSubmitted`, `GotHandoffRecorded`, `GotToolResult`) each inline their own copy of the broadcast-on-success logic.
- **Suggestion:** Consider extracting a small helper like `broadcastOnSuccess : Model -> String -> Api.ApiResult -> Cmd Msg` that returns the broadcast command on success and `Cmd.none` otherwise. This would reduce the repeated `when result is` / `Api.ApiSuccess { body } ->` / `broadcastToClients` / `_ -> Cmd.none` blocks to single-line calls.

#### Suggestion 3: Using `model` instead of `updatedModel` for broadcast in `GotToolResult`
- **File:** `packages/chorus/src/Main.gren`
- **Line:** 1294
- **Category:** Style
- **Description:** In the `GotToolResult` success branch, `updatedModel` is constructed (with modified `activeExecutors`) and returned as the new model, but the broadcast on line 1294 uses `broadcastToClients model` (the old model). While this is not a bug (only `activeExecutors` differs, and `broadcastToClients` only reads `websocketClients`), it is inconsistent with the return value and could confuse a reader into thinking the wrong client set is being used.
- **Suggestion:** Use `broadcastToClients updatedModel` for consistency with the model being returned.

#### Suggestion 4: `refreshCurrentPageData` does not refresh AgentsPage or ProvidersPage on task changes
- **File:** `packages/chorus-ui/src/Main.gren`
- **Line:** 1768-1782
- **Category:** Correctness
- **Description:** The `refreshCurrentPageData` function handles `BoardPage` and `TaskDetailPage` but falls through to `Cmd.none` for all other pages. This means if a user is on the AgentsPage and a task changes status (e.g., an agent completes), the AgentsPage will not update. The old polling mechanism would have refreshed the current page regardless. This is likely acceptable since agents/providers don't change when tasks change, but it is worth noting that the AgentsPage won't see real-time updates if an agent is created or deleted by another client -- those come through `agents_changed`, which does handle `AgentsPage`.
- **Suggestion:** No code change needed, but consider adding a brief comment to `refreshCurrentPageData` noting that it intentionally only refreshes task-related pages, since other entity types have their own message types.

#### Suggestion 5: No backoff strategy for reconnection
- **File:** `packages/chorus-ui/src/Main.gren`
- **Line:** 1691-1696
- **Category:** Correctness
- **Description:** The reconnection uses a fixed 3-second delay via `Process.sleep 3000`. If the server is down for an extended period, the UI will attempt to reconnect every 3 seconds indefinitely. This could generate unnecessary network traffic and log noise.
- **Suggestion:** Consider implementing exponential backoff (e.g., 3s, 6s, 12s, up to a max of 30s) by tracking the retry count in the model. This is a minor concern for a tool that typically runs locally, so this is a low-priority suggestion.

## Overall Assessment

**Decision:** CHANGES REQUESTED

The two blocking issues must be addressed before merge:
1. Fix the misleading comments on `broadcastToClients` and `WsBroadcastResult` so they accurately describe the actual behavior (fire-and-forget, cleanup via subscriptions).
2. Remove the unused `import WebSocket.Connection as WsConnection` from the UI.

Both are quick fixes. The suggestions are worth considering but not required for merge.
