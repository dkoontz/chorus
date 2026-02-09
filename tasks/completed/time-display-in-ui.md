# Task: Format Timestamp Display in UI

## Summary

Replace raw milliseconds-since-epoch timestamp display in the Chorus UI with human-readable formatted dates (`YYYY-MM-DD HH:MM`) using the browser's local time zone, with "Today" and "Yesterday" special cases.

## Current State

Three `formatTimestamp` functions all do `String.fromInt (Time.posixToMillis posix)` — displaying raw epoch milliseconds:
- `packages/chorus-ui/src/View/Board.gren` (line ~151) — kanban cards
- `packages/chorus-ui/src/View/TaskDetail.gren` (line ~509) — task info, event list, attachment times, queued messages
- `packages/chorus-ui/src/View/History.gren` (line ~121) — timeline events

## Requirements

1. **Get browser time zone**: Use `Time.here` on app init, store `Time.Zone` in Model
2. **Track current time**: Reuse existing `lastPoll` which already updates every 2s via `Time.every 2000 Poll`
3. **Format timestamps as `YYYY-MM-DD HH:MM`**: 24-hour clock, zero-padded
4. **Special case "Today"**: If timestamp is after midnight of today in user's zone → `Today HH:MM`
5. **Special case "Yesterday"**: If timestamp is after midnight of yesterday in user's zone → `Yesterday HH:MM`
6. **Apply to all three views**: Board, TaskDetail, History

## Approach

1. Create a shared formatting module `packages/chorus-ui/src/FormatTime.gren` with the formatting logic
2. Update `packages/chorus-ui/src/Main.gren` — add `Time.Zone` to Model, get zone on init, add Msg for receiving zone, pass zone + now to views
3. Update `packages/chorus-ui/src/View/Board.gren` — update Props, use shared formatter
4. Update `packages/chorus-ui/src/View/TaskDetail.gren` — update Props, use shared formatter
5. Update `packages/chorus-ui/src/View/History.gren` — update Props, use shared formatter

## Files to Modify

- `packages/chorus-ui/src/Main.gren`
- `packages/chorus-ui/src/View/Board.gren`
- `packages/chorus-ui/src/View/TaskDetail.gren`
- `packages/chorus-ui/src/View/History.gren`

## New File

- `packages/chorus-ui/src/FormatTime.gren` — shared timestamp formatting logic

## Acceptance Criteria

- [ ] `Time.Zone` is obtained on app init and stored in Model
- [ ] Board card timestamps display formatted dates instead of raw millis
- [ ] TaskDetail timestamps display formatted dates
- [ ] History timeline timestamps display formatted dates
- [ ] Timestamps from today show `Today HH:MM`
- [ ] Timestamps from yesterday show `Yesterday HH:MM`
- [ ] All other dates show `YYYY-MM-DD HH:MM`
- [ ] App builds successfully with `npm run build:all`

## Out of Scope

- Changing backend API format (timestamps remain as millis in JSON)
- Locale-specific date formatting
- Handling time zone changes during a session

## Testing

- Build with `npm run build:all` to verify compilation
- Manual verification in browser
