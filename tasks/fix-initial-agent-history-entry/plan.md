# Fix Initial Agent History Entry

## Summary

Distinguish between the system starting an agent on a task (initial run) and one agent handing off to another agent (handoff tool use), so the history timeline accurately represents what happened.

## Requirements

- Add a new event type `agent_started` for when the system starts the first agent on a task
- Keep `agent_handoff_started` for when one agent uses the handoff tool to invoke another agent
- Create new `requestStartAgent` and `requestCompleteAgent` functions in `Web/Api.gren` (do NOT parameterize the existing handoff functions)
- Extract shared logic between start/complete functions into internal helpers
- The UI timeline must render `agent_started` events with appropriate styling and label
- The `agent_started` event should have the same expandable detail (showing input/prompt) as `agent_handoff_started`
- Add an `agent_completed` event type for when the initial agent finishes (vs `agent_handoff_completed` for handoff-initiated agents)

## Acceptance Criteria

- [ ] When a user clicks "Start" in the UI to run the first agent on a task, the history records an `agent_started` event (not `agent_handoff_started`)
- [ ] When an agent uses the handoff tool to invoke another agent, the history still records `agent_handoff_started`
- [ ] When the initial agent completes, the history records `agent_completed` (not `agent_handoff_completed`)
- [ ] When a handoff-invoked agent completes, the history still records `agent_handoff_completed`
- [ ] The UI's `eventTypeClass` in `View/History.gren` maps `agent_started` and `agent_completed` to a distinct CSS class (e.g., `"agent"`)
- [ ] The `agent_started` and `agent_completed` events in `View/TaskDetail.gren` are expandable with the same detail view as handoff events (showing input/prompt and output respectively)
- [ ] The app builds successfully with `npm run build:all`
- [ ] Existing tests pass with `npm run test`

## Out of Scope

- Changing the `HandoffRecord` type or `agentChain` field structure (both initial and handoff records continue to use the same data structure)
- Retroactively fixing history for existing tasks
- Adding new CSS styling beyond the class mapping

## Technical Context

### Files to Modify

- `packages/chorus/src/Web/Api.gren` - Add `requestStartAgent` and `requestCompleteAgent` functions alongside the existing handoff functions. Extract shared logic into internal helpers (`startAgentOnTask`, `completeAgentOnTask`) that accept the event type string.
- `packages/chorus/src/Main.gren` - Call `Api.requestStartAgent` from `GotAgentLookup` (~line 826, UI-initiated starts). Keep `Api.requestStartHandoff` in `GotDeferredHandoffLookup` (~line 895, handoff-tool-initiated starts). In `GotAgentComplete`, use the presence of `pendingHandoffResponses` to choose between `Api.requestCompleteAgent` and `Api.requestCompleteHandoff`.
- `packages/chorus-ui/src/View/History.gren` - Add `agent_started` and `agent_completed` to the `eventTypeClass` function (~line 135) mapping them to a CSS class (e.g., `"agent"`)
- `packages/chorus-ui/src/View/TaskDetail.gren` - Include `agent_started` and `agent_completed` as expandable events alongside the existing handoff events (~line 623)

### Related Files (reference only)

- `packages/shared/Types.gren` - Defines `Event`, `History`, `HandoffRecord` types. No changes needed (events use string-based `eventType`).
- `packages/chorus/src/Task/Registry.gren` - Defines `recordEvent`. No changes needed.
- `packages/chorus/src/Web/ToolExecution.gren` - Handoff tool dispatch. No changes needed (it returns `DeferredHandoff` which is handled by `Main.gren`).
- `packages/chorus-ui/src/Api.gren` - Frontend API calls. No changes needed (the frontend still calls the same endpoint).

### Patterns to Follow

- Event types are strings in `Dict String String` data -- no changes to `Types.gren` needed
- In `Main.gren`, the `GotAgentLookup` handler is the UI start path; `GotDeferredHandoffLookup`/`GotDeferredHandoffStarted` is the handoff tool path
- The UI's `formatEventType` function already handles arbitrary event type strings by replacing underscores with spaces and capitalizing, so `agent_started` will render as "Agent Started" automatically

### Implementation Approach

Create separate public functions for agent start/complete vs handoff start/complete. Extract shared task-mutation logic into internal helpers.

**Web/Api.gren - Start path:**

1. Extract the body of `requestStartHandoff` into an internal helper:
   ```gren
   startAgentOnTask : String -> ApiContext -> TaskId -> StartHandoffParams -> (ApiResult -> msg) -> Cmd msg
   ```
   The first argument is the event type string. The helper contains all the existing logic (task lookup, conflict check, HandoffRecord creation, task update, event recording, response building).

2. Redefine the public functions as thin wrappers:
   ```gren
   requestStartAgent ctx taskId params toMsg =
       startAgentOnTask "agent_started" ctx taskId params toMsg

   requestStartHandoff ctx taskId params toMsg =
       startAgentOnTask "agent_handoff_started" ctx taskId params toMsg
   ```

**Web/Api.gren - Complete path:**

1. Extract the body of `requestCompleteHandoff` into an internal helper:
   ```gren
   completeAgentOnTask : String -> ApiContext -> TaskId -> CompleteHandoffParams -> (ApiResult -> msg) -> Cmd msg
   ```

2. Redefine the public functions as thin wrappers:
   ```gren
   requestCompleteAgent ctx taskId params toMsg =
       completeAgentOnTask "agent_completed" ctx taskId params toMsg

   requestCompleteHandoff ctx taskId params toMsg =
       completeAgentOnTask "agent_handoff_completed" ctx taskId params toMsg
   ```

**Main.gren - Start path:**

1. In `GotAgentLookup` (~line 826), change `Api.requestStartHandoff` to `Api.requestStartAgent`
2. `GotDeferredHandoffLookup` (~line 895) keeps calling `Api.requestStartHandoff`

**Main.gren - Complete path:**

The `GotAgentComplete` handler (~line 944) already has a natural way to distinguish the two cases: `pendingHandoffResponses`. If `Dict.get taskIdStr model.pendingHandoffResponses` returns `Just _`, the agent was started via handoff; if `Nothing`, it was a UI-initiated start. No new state needed in `ExecutorState`.

1. In `GotAgentComplete`, where `requestCompleteHandoff` is called (lines 1031, 1063, 1093), replace with a conditional:
   - If `maybeDeferredResponse` is `Just _` → call `Api.requestCompleteHandoff`
   - If `maybeDeferredResponse` is `Nothing` → call `Api.requestCompleteAgent`

Note: The HTTP API route `CompleteHandoff` (line 1894-1897) continues to call `Api.requestCompleteHandoff` since it's used by external handoff tool responses.

**UI changes:**

1. In `View/History.gren` `eventTypeClass`, add:
   - `"agent_started"` -> `"agent"`
   - `"agent_completed"` -> `"agent"`
2. In `View/TaskDetail.gren` `viewEvent`, extend the handoff event check (~line 623) to also match `"agent_started"` and `"agent_completed"` so they are expandable with the same detail view

### Where the Distinction Originates

The key distinction is in `Main.gren`:

- **`GotAgentLookup`** (~line 782): Reached when `Router.StartHandoff` HTTP route is hit from the UI's "Start" button. This is NOT a handoff → call `Api.requestStartAgent`.
- **`GotDeferredHandoffLookup`** (~line 866): Reached when an agent's handoff tool fires a `DeferredHandoff`. This IS a handoff → call `Api.requestStartHandoff`.

For the complete path, the distinction is implicit: `pendingHandoffResponses` is only populated for deferred handoff agents (set at Main.gren ~line 933). UI-initiated agents never have an entry there.

## Testing Requirements

- Run `npm run build:all` to verify compilation
- Run `npm run test` to verify existing tests pass
- Manual verification: start a task via the UI, check history shows `agent_started` (not `agent_handoff_started`)
- Manual verification: have an agent use the handoff tool, check history shows `agent_handoff_started`
- Manual verification: when the initial agent completes, history shows `agent_completed`
- Manual verification: when a handoff-invoked agent completes, history shows `agent_handoff_completed`

## Notes

- The `agentChain` array and `HandoffRecord` type are shared between both paths and do not need to change -- only the event type string in the history differs
- The `handoffIndex` data field in events still works the same way for both event types, as both create entries in the `agentChain`
- The UI's `formatEventType` function already handles arbitrary event type strings by replacing underscores with spaces and capitalizing, so `agent_started` will render as "Agent Started" and `agent_completed` will render as "Agent Completed" automatically
- `StartHandoffParams` and `CompleteHandoffParams` type aliases work for both the new agent functions and the existing handoff functions (same fields needed)
