# Developer Report

## Task
Make the planning step a deliberate user action rather than automatic. Tasks created via the UI remain in "Pending" status until the user clicks a "Plan Task" button. The "Start Task" action only appears once a task reaches "ReadyToStart" (planned) status.

## Files Modified
- `packages/chorus/src/Web/Router.gren` - Added `PlanTask TaskId` route variant for `POST /api/tasks/:id/plan`; added route parsing and `routeToString` case
- `packages/chorus/src/Web/Api.gren` - Added `requestPlanTask` handler that validates task is in Pending status and returns the task description for planner dispatch; removed `Pending -> Active` direct transition from `requestStartHandoff` status handling
- `packages/chorus/src/Main.gren` - Removed `dispatchPlanner` call from `GotTaskCreated` so newly created tasks stay in Pending; added `GotPlanTaskResult` message type and handler that dispatches the planner on success; added `Router.PlanTask` route handling that calls `Api.requestPlanTask`
- `packages/chorus-ui/src/View/TaskDetail.gren` - Added `onPlanTask` prop to Props; changed Pending status actions from "Start Task" (which called `onStatusUpdate` with "active") to "Plan Task" button (which calls `onPlanTask`)
- `packages/chorus-ui/src/Main.gren` - Added `PlanTask String` and `PlanTaskStarted (Result Http.Error Types.Task)` message variants; added handlers for both; wired `onPlanTask = PlanTask` in the TaskDetail view props
- `packages/chorus-ui/src/Api.gren` - Added `planTask` function that POSTs to `/api/tasks/:id/plan` with empty body; added it to module exports

## Build Status
**Status:** PASS

All components (UI, tools, chorus) compiled successfully with `npm run build:all`.

## Test Status
**Status:** PASS

```
62 passed, 0 failed  (unit tests)
19 passed, 0 failed  (integration tests)
```

## Implementation Notes
- The `requestPlanTask` handler in `Web/Api.gren` validates the task is in Pending status and returns a 409 error if not. It returns the task description alongside the API result so the caller (Main.gren) can pass it to `dispatchPlanner`.
- The `GotPlanTaskResult` handler in Main.gren follows the same pattern previously used by `GotTaskCreated`: on API success, it dispatches the planner agent if the agent registry is available.
- The `PlanTaskStarted` handler in the UI follows the existing `HandoffStarted` pattern for updating task state in the model after a successful API call.
- The `requestStartHandoff` function no longer transitions from `Pending -> Active`. Only `ReadyToStart -> Active` and `Waiting -> Active` remain valid. This ensures tasks must go through planning before they can be started.
- Existing flows are unchanged: `GotAnswersSubmitted` still re-dispatches the planner after answers are submitted, and the board view continues to show tasks in the Pending column since no changes were needed there.

## Iteration
1
