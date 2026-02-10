# Handoff Event Details

## Summary
Make handoff history events (`agent_handoff_started` and `agent_handoff_completed`) expandable in the task detail timeline, showing the full prompt (input) sent to the agent and the full output returned. This requires storing the prompt in the HandoffRecord on the backend and adding expand/collapse UI behavior for handoff events in the frontend.

## Requirements
- Add an `input` field to `HandoffRecord` to persist the prompt sent to the agent at handoff start
- Include a `handoffIndex` key in the `agent_handoff_started` and `agent_handoff_completed` event data dicts so the UI can correlate events to specific HandoffRecords in the task's `agentChain`
- Make handoff events in the task detail history timeline expandable/collapsible by clicking
- When expanded, `agent_handoff_started` shows the input/prompt text from the corresponding HandoffRecord
- When expanded, `agent_handoff_completed` shows the output text and completion report summary (if present) from the corresponding HandoffRecord
- Events default to collapsed, showing only the current compact metadata (agent name, output length)

## Acceptance Criteria
- [ ] `HandoffRecord` type in shared Types has a new `input : String` field
- [ ] `encodeHandoffRecord` encodes the `input` field
- [ ] `handoffRecordDecoder` decodes the `input` field
- [ ] `requestStartHandoff` in Web/Api.gren stores `params.prompt` in the new HandoffRecord's `input` field
- [ ] `agent_handoff_started` event data includes `handoffIndex` (string of the array index in agentChain)
- [ ] `agent_handoff_completed` event data includes `handoffIndex`
- [ ] UI model tracks which events are expanded (a Set of event indices or similar)
- [ ] Clicking a handoff event in the task detail timeline toggles its expanded/collapsed state
- [ ] Expanded `agent_handoff_started` event displays the input/prompt text
- [ ] Expanded `agent_handoff_completed` event displays the output text and completion report summary if present
- [ ] Non-handoff events are unaffected (not expandable)
- [ ] Build succeeds (`npm run build:all`)

## Out of Scope
- Changing the History event `data` dict to store large content (full output stays on HandoffRecord)
- Pagination or lazy-loading of event details
- Making non-handoff events expandable
- Backwards-compatible decoding of old HandoffRecords missing the `input` field

## Technical Context

### Files to Modify
- `packages/shared/Types.gren` - Add `input : String` field to `HandoffRecord`, update `encodeHandoffRecord` and `handoffRecordDecoder`
- `packages/chorus/src/Web/Api.gren` - In `requestStartHandoff` (~line 852): set `input = params.prompt` on the new HandoffRecord. In both `requestStartHandoff` (~line 896) and `requestCompleteHandoff` (~line 989): add `handoffIndex` to the event data dict
- `packages/chorus-ui/src/Main.gren` - Add `expandedEvents : Set Int` (or similar) to Model, add a `ToggleEventExpanded Int` message, wire it through to TaskDetail props
- `packages/chorus-ui/src/View/TaskDetail.gren` - Update `viewEvent` to accept the task's agentChain and expanded state, make handoff events clickable, render expanded detail content showing input/output
- `packages/chorus-ui/static/styles.css` - Add styles for expandable events: cursor pointer on handoff events, expand/collapse indicator, detail content area with appropriate formatting for potentially long text

### Related Files (reference only)
- `packages/chorus/src/Main.gren` - Where agent spawning happens after handoff is recorded; the `prompt` value flows through `GotAgentLookup` -> `requestStartHandoff` -> `GotHandoffRecorded` -> agent spawn
- `packages/chorus-ui/src/Api.gren` - API client; no changes needed since HandoffRecord data comes via the existing task fetch
- `packages/chorus-ui/src/View/History.gren` - Alternative history view (used elsewhere); not the one shown on the task detail page

### Patterns to Follow
- The existing `Dict String String` event data pattern for adding string metadata like `handoffIndex` (see existing `agentName` and `outputLength` keys)
- The `viewEvent` function in `View/TaskDetail.gren` (line 575) renders individual events; extend this rather than replacing it
- The `PlanningEditState` / `editingPlanning` pattern in Main.gren for managing UI toggle state through the Gren architecture (Model field + Msg variant + update handler + props threading)
- `HandoffRecord` encoder uses `Encode.object` with a list of key/value pairs; add the new field in the same style
- `handoffRecordDecoder` uses `Decode.map5`; adding a sixth field requires switching to `Decode.map5 |> Decode.andThen` chaining (same pattern used throughout the file, e.g., `descriptionOnlyTaskDecoder`)

## Testing Requirements
- Build the full application with `npm run build:all` and verify it compiles without errors
- Start the app, create a task, plan it, start it with an agent, and verify:
  - The `agent_handoff_started` event appears in the timeline with a clickable indicator
  - Clicking the event expands it to show the prompt/input text
  - When the agent completes, the `agent_handoff_completed` event appears and can be expanded to show the output
  - Clicking an expanded event collapses it back to the compact view
  - Non-handoff events (task_created, status_changed, etc.) remain non-expandable

## Notes
- The `input` field is added to `HandoffRecord` which is persisted in task JSON files. Per project constraints ("no backwards compatibility"), old tasks missing the `input` field will fail to decode. This is acceptable.
- The `handoffIndex` in event data is stored as a String (since `Dict String String`) representing the zero-based index into the task's `agentChain` array. The UI uses this to look up the correct HandoffRecord from the already-loaded task object.
- The `View/TaskDetail.gren` file has its own `viewEvent` function (line 575) which is separate from `View/History.gren`. The task detail page uses the TaskDetail version -- that is the one to modify.
- The History view (`View/History.gren`) is a standalone component used in a different context. It does not need changes for this task.
- The UI already has the full task object (including `agentChain` with all HandoffRecords) loaded via `selectedTask` in the model. No additional API calls are needed to fetch handoff details.
