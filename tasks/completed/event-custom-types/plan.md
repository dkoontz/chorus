# Task: event-custom-types

## Summary

Replace the `String`-typed `eventType` field in the `Event` type with a custom type `EventType`, and convert `SourceInfo.sourceType` to a `SourceType` custom type. Only convert to strings for JSON serialization.

## Background

Events are currently expressed as strings like `"agent_started"`, `"agent_handoff_started"`, etc. Nothing other than actual textual data should be a string. The same applies to `SourceInfo.sourceType` which uses a closed set of values: `"web"`, `"terminal"`, `"test"`, `"xmpp"`.

## Event Types Inventory

13 distinct event types produced by the backend:

| Event String | Where Created |
|---|---|
| `task_created` | `Task/Registry.gren` |
| `status_changed` | `Web/Api.gren`, `Web/ToolExecution.gren` |
| `tool_executed` | `Main.gren` |
| `planning_started` | `Main.gren` |
| `planning_completed` | `Web/Api.gren` |
| `planning_failed` | `Main.gren` |
| `planning_questions_returned` | `Web/Api.gren` |
| `answers_submitted` | `Web/Api.gren` |
| `agent_started` | `Web/Api.gren` |
| `agent_completed` | `Web/Api.gren` |
| `agent_handoff_started` | `Web/Api.gren` |
| `agent_handoff_completed` | `Web/Api.gren` |
| `completion_report_submitted` | `Web/ToolExecution.gren` |

The UI (`View/History.gren`) also references unused strings: `message_received`, `session_started`, `session_ended`, `error`. These should be removed from the UI code since they are not produced by the backend.

## SourceType Inventory

`SourceInfo.sourceType` uses a closed set: `"web"`, `"terminal"`, `"test"`, `"xmpp"`.

## Approach

### Part 1: EventType custom type

1. Define `EventType` custom type in `packages/shared/Types.gren` with all 13 variants
2. Add `eventTypeToString : EventType -> String` and `eventTypeFromString : String -> Maybe EventType` functions
3. Update `Event` record: `eventType : EventType` instead of `eventType : String`
4. Update encoder/decoder to serialize/deserialize through strings (backward compatible JSON)
5. Update all backend creation sites:
   - `Task/Registry.gren` - `recordEvent` signature changes to accept `EventType`
   - `Web/Api.gren` - all event construction sites
   - `Web/ToolExecution.gren` - event construction sites
   - `Main.gren` - event construction sites
6. Update UI code:
   - `View/History.gren` - replace string matching with custom type matching, remove unused event types
   - `View/TaskDetail.gren` - replace string matching with custom type matching

### Part 2: SourceType custom type

1. Define `SourceType` custom type in `packages/shared/Types.gren` with variants: `Web`, `Terminal`, `Test`, `Xmpp`
2. Add `sourceTypeToString` / `sourceTypeFromString` conversion functions
3. Update `SourceInfo` record to use `SourceType` instead of `String`
4. Update encoder/decoder
5. Update all creation and matching sites

## Files to Modify

- `packages/shared/Types.gren` - Define `EventType` and `SourceType`, update `Event` and `SourceInfo` records, add encoders/decoders/converters
- `packages/chorus/src/Task/Registry.gren` - Update `recordEvent` signature
- `packages/chorus/src/Web/Api.gren` - Update all event construction sites
- `packages/chorus/src/Web/ToolExecution.gren` - Update event construction sites
- `packages/chorus/src/Main.gren` - Update event construction sites
- `packages/chorus-ui/src/View/History.gren` - Replace string matching with custom type matching
- `packages/chorus-ui/src/View/TaskDetail.gren` - Replace string matching with custom type matching
- Test files as needed

## Acceptance Criteria

- [ ] `EventType` custom type exists with all 13 variants
- [ ] `Event.eventType` field uses `EventType` instead of `String`
- [ ] JSON serialization produces the same string values as before (backward compatible)
- [ ] JSON deserialization decodes string values to the custom type
- [ ] All backend creation sites use `EventType` constructors
- [ ] `Registry.recordEvent` accepts `EventType` instead of `String`
- [ ] UI pattern-matches on `EventType` constructors instead of strings
- [ ] Unused event type references removed from UI
- [ ] `SourceType` custom type exists with 4 variants
- [ ] `SourceInfo.sourceType` uses `SourceType` instead of `String`
- [ ] All tests pass
- [ ] Application builds successfully
