# Code Review Report

## Summary

The implementation correctly adds the `input` field to `HandoffRecord`, includes `handoffIndex` in handoff event data, and builds an expand/collapse UI for handoff events in the task detail timeline. The build succeeds and all 46 tests pass. One blocking issue was found regarding the `handoffIndex` computation being vulnerable to a race condition, plus a few minor suggestions.

## Issues Found

### BLOCKING Issues

#### Issue 1: `handoffIndex` in `requestStartHandoff` reads stale task before update

- **File:** `packages/chorus/src/Web/Api.gren`
- **Line:** 891-892
- **Category:** Correctness
- **Description:** The `handoffIndex` is computed as `Array.length (Types.taskAgentChain task)` where `task` is the snapshot fetched at the beginning of the request handler. The new record is then appended inside `updateFn`, which runs within `Registry.updateTask`. If two concurrent `requestStartHandoff` calls race on the same task, both could read the same `task` snapshot and compute the same `handoffIndex`, even though they append to different chain positions. The event data would then contain a `handoffIndex` pointing to the wrong `HandoffRecord` for one of the two events.

  The `handoffIndex` should be computed inside `updateFn` (where the chain state is current) and threaded out, or computed after the update completes. A similar concern applies to `requestCompleteHandoff` (line 978-979) where `chain` is also derived from the pre-update task snapshot, though in practice concurrent complete-handoff calls on the same task are less likely.

- **Suggestion:** Move the `handoffIndex` computation so it derives from the task state inside `updateFn` (or equivalently, from the returned `updatedTask`). For `requestStartHandoff`, compute it as `Array.length (Types.taskAgentChain updatedTask) - 1` after `Registry.updateTask` resolves. For `requestCompleteHandoff`, the same approach works. This ensures the index always reflects the actual position in the chain after the update.

### Suggestions

#### Suggestion 1: `visibleData` filtering runs on all events, not just handoff events

- **File:** `packages/chorus-ui/src/View/TaskDetail.gren`
- **Line:** 627-628
- **Category:** Simplification
- **Description:** `Dict.remove "handoffIndex" event.data` is computed for every event, including non-handoff events that will never have a `handoffIndex` key. This is harmless but slightly wasteful. It also makes it less clear that the filtering is specifically a handoff concern.
- **Suggestion:** Guard the `Dict.remove` behind the `isHandoffEvent` check: `if isHandoffEvent then Dict.remove "handoffIndex" event.data else event.data`. This makes the intent explicit and avoids unnecessary work for non-handoff events.

#### Suggestion 2: Consider using unicode triangle characters for expand/collapse indicator

- **File:** `packages/chorus-ui/src/View/TaskDetail.gren`
- **Line:** 636-642
- **Category:** Style
- **Description:** The expand/collapse indicator uses plain ASCII `"+ "` and `"- "` characters. While functional, these can be visually ambiguous (the `-` could be mistaken for a bullet/dash). Unicode triangle characters like `"\u{25B6} "` (right-pointing) and `"\u{25BC} "` (down-pointing) are a common convention for disclosure widgets and would provide clearer affordance.
- **Suggestion:** Replace `"+ "` with `"\u{25B6} "` and `"- "` with `"\u{25BC} "`, or use a CSS-based approach (e.g., a rotated border triangle via `::before` pseudo-element on the handoff class) to avoid embedding presentation in the Gren view code.

#### Suggestion 3: `handoffClasses` could use a more structured approach

- **File:** `packages/chorus-ui/src/View/TaskDetail.gren`
- **Line:** 608-612
- **Category:** Style
- **Description:** The CSS class string is built via string concatenation (`"event-item event-item-handoff"`). This is fine for two classes, but if more conditional classes are added later, string concatenation becomes unwieldy.
- **Suggestion:** This is minor and acceptable as-is. Just noting that if more conditional classes are added in the future, consider extracting a helper or using a list-based approach.

## Overall Assessment

**Decision:** CHANGES REQUESTED

The blocking issue is a race condition where concurrent handoff-start requests on the same task could produce events with incorrect `handoffIndex` values. While rare in practice (since a task typically has one active agent at a time), the computation is straightforwardly fixable by deriving the index from the post-update task state rather than the pre-update snapshot. The rest of the implementation is clean, well-structured, follows project conventions, and all acceptance criteria from the task specification are met.
