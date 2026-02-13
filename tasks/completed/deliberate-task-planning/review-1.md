# Code Review Report

## Summary
The implementation correctly makes task planning a deliberate user action. All six files are modified consistently, following existing patterns (particularly the `SubmitAnswers` / `GotAnswersSubmitted` pattern for the new `PlanTask` / `GotPlanTaskResult` flow). The code is well-structured and passes both build and test suites.

## Issues Found

### BLOCKING Issues

None.

### Suggestions

#### Suggestion 1: `requestPlanTask` returns the task in Pending status before `dispatchPlanner` transitions it to Planning
- **File:** `packages/chorus/src/Web/Api.gren`
- **Line:** 476-518
- **Category:** Correctness
- **Description:** The `requestPlanTask` handler returns the task still in `Pending` status as the API response. The status transition to `Planning` only happens later when `dispatchPlanner` runs (called from `GotPlanTaskResult` in Main.gren). This means the UI receives the task as `Pending` and only sees the `Planning` status on the next 2-second poll. The existing `requestSubmitAnswers` has the same characteristic (it transitions to `Planning` inside the API handler itself, before returning), so this is a slight deviation from that pattern. However, since the UI polls every 2 seconds, this is a minor inconsistency rather than a functional problem.
- **Suggestion:** For perfect consistency with `requestSubmitAnswers` (which performs the status update in the API handler), `requestPlanTask` could update the task status to `Planning` and record the `planning_started` event before returning. This would mean `dispatchPlanner` would no longer need to do the status update itself (the planner dispatch would still happen in `GotPlanTaskResult`). This would make the API response accurate and the UI would immediately show `Planning`. However, since `dispatchPlanner` already handles this transition and the current approach works correctly end-to-end, this is a low-priority improvement.

#### Suggestion 2: The `description` field carries an empty string through error paths
- **File:** `packages/chorus/src/Web/Api.gren`
- **Line:** 476 (type signature)
- **Category:** Style
- **Description:** The return type `{ apiResult : ApiResult, description : String }` uses an empty string as a sentinel value for `description` in error paths (lines 485, 508, 515). The caller in Main.gren only reads `description` on `ApiSuccess`, so this is safe. However, using `Maybe String` for `description` would make the intent more explicit and would be more aligned with the "make invalid states unrepresentable" coding standard.
- **Suggestion:** This is a minor improvement and the current approach matches the existing `requestSubmitAnswers` pattern (which uses `enrichedPrompt = ""` in error paths). Changing it would require changing both functions. Not worth doing in this PR, but worth noting for a future cleanup.

## Overall Assessment

**Decision:** APPROVED

The implementation is clean, correct, and follows established patterns consistently. All six requirements from the task spec are addressed:

1. Automatic `dispatchPlanner` call removed from `GotTaskCreated` -- now just sends the API response.
2. New `POST /api/tasks/:id/plan` endpoint added via `Router.PlanTask`, `Api.requestPlanTask`, and `GotPlanTaskResult`.
3. UI `Pending` status actions changed from "Start Task" to "Plan Task" button using the new `onPlanTask` prop.
4. "Start Task" with agent selector remains only for `ReadyToStart` status (unchanged, already correct).
5. `Pending -> Active` direct transition removed from `requestStartHandoff`.
6. Frontend `Api.planTask` function and `PlanTask`/`PlanTaskStarted` message types added and wired.

Both suggestions are low-priority style improvements that follow from the "make invalid states unrepresentable" coding standard, but the current approach is safe and consistent with existing patterns in the codebase.
