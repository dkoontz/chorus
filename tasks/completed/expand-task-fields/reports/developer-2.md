# Developer Report

## Task
Refactored the `Task` type from a flat record with optional planning fields to a union type (`DescriptionOnly | Planned`) as requested in review-1. This follows the coding standard "Make Invalid States Unrepresentable" by ensuring a task either has no planning data or has all four planning fields (summary, requirements, acceptanceCriteria, plan).

## Files Modified

### Backend
- `src/chorus/src/Task/Registry.gren` - Replaced flat `Task` type alias with union type `DescriptionOnly DescriptionOnlyTask | Planned PlannedTask`. Added `PlanningFields` type alias. Added accessor functions (`taskId`, `taskDescription`, `taskStatus`, `taskCreatedAt`, `taskUpdatedAt`, `taskSessionId`, `taskSource`, `taskAgentWorkspace`, `taskAttachments`). Added `isPlanned`, `planTask`, and setter functions (`setTaskStatus`, `setUpdatedAt`, `setSessionId`, `setAttachments`). Updated `encodeTask` with `"taskType"` discriminator field. Added three decoders for backward compatibility: `descriptionOnlyTaskDecoder`, `plannedTaskDecoder`, `legacyTaskDecoder`.
- `src/chorus/src/Web/Api.gren` - Updated `requestUpdatePlanning` to pattern match on `DescriptionOnly`/`Planned` variants and use `planTask`. Updated attachment handlers to use `Registry.setAttachments` and `Registry.taskAttachments` accessors.

### Frontend
- `src/chorus-ui/src/Api.gren` - Mirrored union type structure from backend. Added same accessor functions. Updated decoders with same three-decoder backward compatibility pattern. Renamed `taskId` parameters in API functions to `tid` to avoid Gren's no-shadowing rule.
- `src/chorus-ui/src/Main.gren` - Updated `StatusUpdated`, `EditPlanningSection`, and `SavePlanning` handlers to use accessor functions instead of direct field access.
- `src/chorus-ui/src/View/TaskDetail.gren` - Updated `viewPlanningSections` to pattern match on `DescriptionOnly` (shows "Not yet planned") vs `Planned` (shows all sections). Replaced all direct field accesses with accessor functions.
- `src/chorus-ui/src/View/TaskList.gren` - Replaced all direct field accesses with accessor functions.
- `src/chorus-ui/src/View/Dashboard.gren` - Replaced all direct field accesses with accessor functions.

### Tests
- `src/chorus/tests/unit/RegistryTests.gren` - Rewrote all tests to use union type constructors. Added `testTaskDecodeBackwardCompatWithPlanningFields` and `testDescriptionOnlyRoundTrip` tests. Total: 13 registry tests.
- `src/chorus/tests/integration/IntegrationRunner.gren` - Updated all task field accesses to use `Registry.taskId`, `Registry.taskDescription`, `Registry.taskStatus`, and `Registry.taskAttachments` accessors.

## Build Status
**Status:** PASS

```
> npm run build:app
Success! Compiled 6 modules. (UI)
Success! Compiled 4 modules. (Tools)
Success! Compiled 8 modules. (Chorus)
```

## Test Status
**Status:** PASS

```
> npm run test
Running 25 tests...
25 passed, 0 failed

Running 18 integration tests...
18 passed, 0 failed
```

## Implementation Notes

- Used `"taskType"` as the JSON discriminator field name rather than `"type"` (as suggested in the review) because `"type"` is already used inside the `status` JSON object. Using the same key at the top level would cause confusion during decoding.
- The legacy decoder handles backward compatibility for existing task.json files that lack a `taskType` field. It inspects whether planning fields (summary, requirements, acceptanceCriteria, plan) are present and non-empty to decide between `DescriptionOnly` and `Planned`.
- Gren does not allow variable shadowing. The `taskId` accessor function caused conflicts with `taskId` parameters in several functions. Resolved by renaming parameters to `tid` (in frontend API functions), `newId` (in `createTask`), and `theTaskId` (in `updateTask`/`updateStatus`).
- The `planTask` function handles both directions: converting `DescriptionOnly` to `Planned` (by copying all base fields and adding planning data) and updating an existing `Planned` task's planning fields.
- Setter functions (`setUpdatedAt`, `setTaskStatus`, `setSessionId`, `setAttachments`) are needed because record update syntax (`{ t | field = value }`) does not work on union types -- you must pattern match first.

## Iteration
2
