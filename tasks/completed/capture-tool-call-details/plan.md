# Task: Capture Tool Call Details in History

## Problem

When a tool is executed, the `GotToolResult` handler in `Main.gren` records a `ToolExecuted` event with only:
- `tool`: the tool name (e.g., "file.read", "task.get")
- `status`: "success", "error", or "deferred"

The tool's **input** (the `requestBody` JSON) and **output** (the API response body or error message) are not captured in the history event.

## Requirements

1. When a `ToolExecuted` event is recorded, include the tool input (`requestBody` JSON string) in the event data
2. When a `ToolExecuted` event is recorded, include the tool output in the event data — on success, the response body; on error, the error message
3. The UI displays these new fields automatically (existing `viewEventData` in `View/History.gren` renders all Dict entries)

## Acceptance Criteria

- [ ] `ToolExecuted` history events contain an `input` field with the tool's request body JSON
- [ ] `ToolExecuted` history events contain an `output` field with the tool's response body (on success) or error message (on error)
- [ ] Existing `tool` and `status` fields continue to be recorded
- [ ] The UI displays the new `input` and `output` fields in the event timeline
- [ ] The application builds successfully
- [ ] Existing tests pass

## Files to Modify

**`packages/chorus/src/Main.gren`** only:

1. **Update the `GotToolResult` message type** to include `requestBody : String` in its payload
2. **Update the `toMsg` lambda in `GotToolAgentLookup`** to pass `requestBody` through to `GotToolResult`
3. **Update the `GotToolResult` handler** to add `input` and `output` entries to the event data Dict

### Implementation Detail

In the `GotToolResult` handler, change from:
```gren
Dict.empty
    |> Dict.set "tool" toolName
    |> Dict.set "status" status
```
to:
```gren
Dict.empty
    |> Dict.set "tool" toolName
    |> Dict.set "status" status
    |> Dict.set "input" requestBody
    |> Dict.set "output" output
```

Where `output` is extracted from the `result`:
- `Api.ApiSuccess { body } -> body`
- `Api.ApiError { message } -> message`
- `Api.DeferredHandoff _ -> ""`

### Why no other files need changes

- The `Event` type (`data : Dict String String`) already supports arbitrary string data
- `View/History.gren` already renders all dict entries dynamically via `viewEventData`
- `recordEvent` in `Task.Registry` is generic — accepts any `Dict String String`
- Encoders/decoders for `Event` already handle arbitrary dict contents

## Out of Scope

- Truncation of large input/output values (follow-up if needed)
- Changes to the Event type structure
- Changes to the UI rendering logic

## Testing

- Build succeeds: `npm run build:all`
- Existing tests pass: `npm run test`
- Manual verification: Execute a tool and check history.json for `input` and `output` fields
