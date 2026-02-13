# Deliberate Task Planning

## Summary
Make the planning step a deliberate user action rather than an automatic process triggered on task creation. Tasks created via the UI will remain in "pending" status until the user clicks a "Plan Task" button. The "Start Task" action will only be available once a task reaches "planned" status.

## Requirements
1. Remove the automatic `dispatchPlanner` call from `GotTaskCreated` in the backend Main.gren, so newly created tasks remain in `Pending` status
2. Add a new backend endpoint `POST /api/tasks/:id/plan` that triggers the planner (moves task from `Pending` to `Planning` and dispatches the task-validator agent)
3. In the UI task detail view, replace the "Start Task" button for `Pending` tasks with a "Plan Task" button
4. The "Start Task" action (agent select + start) should only appear when the task is in `ReadyToStart` (planned) status -- this is already the case
5. Remove the `Pending -> Active` direct transition from `requestStartHandoff` in the backend since tasks should go through planning first
6. Add frontend API function and message type to call the new plan endpoint

## Acceptance Criteria
- [ ] Creating a task leaves it in `Pending` status with no automatic planner dispatch
- [ ] The task detail view for a `Pending` task shows a "Plan Task" button (not "Start Task")
- [ ] Clicking "Plan Task" transitions the task to `Planning` status and dispatches the planner agent
- [ ] The "Start Task" button with agent selector only appears for tasks in `ReadyToStart` (planned) status
- [ ] `Pending -> Active` is no longer a valid direct transition in `requestStartHandoff`
- [ ] Existing flows (AwaitingInput, answer submission re-dispatching planner) continue to work unchanged
- [ ] The Board view correctly displays tasks in the Pending column until the user triggers planning

## Out of Scope
- Changing how the planner agent itself works (the `task-validator` internal agent)
- Modifying the planning questions / answers flow (this already works correctly)
- Changing how tasks created via the tool API behave (only the web UI-created tasks are affected by the button change; the backend change affects all paths)

## Technical Context

### Files to Modify
- `packages/chorus/src/Main.gren` - Remove `dispatchPlanner` from `GotTaskCreated`; add `PlanTask` route handler that calls `dispatchPlanner`; add `GotPlanTaskResult` message type
- `packages/chorus/src/Web/Router.gren` - Add `PlanTask TaskId` route for `POST /api/tasks/:id/plan`
- `packages/chorus/src/Web/Api.gren` - Remove `Pending -> Active` from `requestStartHandoff` status handling; add `requestPlanTask` handler
- `packages/chorus-ui/src/View/TaskDetail.gren` - Change `Pending` status actions to show "Plan Task" button instead of "Start Task"
- `packages/chorus-ui/src/Main.gren` - Add `PlanTask String` message variant; add `PlanTaskStarted (Result Http.Error Types.Task)` for the response; wire up the handler
- `packages/chorus-ui/src/Api.gren` - Add `planTask : String -> (Result Http.Error Task -> msg) -> Cmd msg` function

### Related Files (reference only)
- `packages/shared/Types.gren` - Contains `TaskStatus` type with `Pending -> Planning` already being a valid transition; no changes needed
- `packages/chorus/src/Task/Registry.gren` - Registry operations; no changes needed
- `packages/chorus-ui/src/View/Board.gren` - Board view; no changes needed (already shows Pending column)

### Patterns to Follow
- Backend route pattern: Follow the existing `StartHandoff` / `SubmitAnswers` pattern for adding a new POST endpoint with task ID
- UI message pattern: Follow `StartTask` / `HandoffStarted` for the new `PlanTask` / `PlanTaskStarted` messages
- API client pattern: Follow `startHandoff` in `Api.gren` for the new `planTask` function
- Status action pattern: Follow `viewStartWithAgent` for the new "Plan Task" button rendering

## Testing Requirements
- Verify that `npm run build:all` succeeds with all changes
- Test creating a task via the UI and confirming it stays in `Pending`
- Test clicking "Plan Task" on a pending task and confirming it transitions to `Planning`
- Test that after planning completes, the task reaches `ReadyToStart` and shows the agent selector
- Run `npm run test` to verify existing unit tests pass

## Notes
- The `Pending -> Planning` transition is already valid in `isValidTransition`, so no change needed there
- The `requestStartHandoff` currently allows starting from `Pending` status. This needs to be removed since we require planning first
- The `dispatchPlanner` function already handles setting status to `Planning` and recording the `planning_started` event, so the new plan endpoint just needs to call it
- The answer submission flow (`GotAnswersSubmitted`) should remain unchanged -- it re-dispatches the planner after answers are submitted
