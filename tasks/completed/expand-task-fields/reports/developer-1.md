# Developer Report

## Task
Add four structured planning fields (`summary`, `requirements`, `acceptanceCriteria`, `plan`) to the Task type across the backend, frontend, and web UI. Add a new `PUT /api/tasks/:id/planning` endpoint for partial updates of these fields. Add display and inline editing of these fields on the task detail page.

## Files Modified
- `src/chorus/src/Task/Registry.gren` - Added `summary : String`, `requirements : Array String`, `acceptanceCriteria : Array String`, `plan : Array String` to the `Task` type alias. Updated `encodeTask` to encode all four fields. Updated `taskDecoder` with backward-compatible `Decode.oneOf` chains for each field. Updated `createTask` to initialize fields to empty defaults.
- `src/chorus/src/Web/Router.gren` - Added `UpdateTaskPlanning String` variant to `Route`. Added route parsing for `PUT /api/tasks/:id/planning`. Added `routeToString` entry.
- `src/chorus/src/Web/Api.gren` - Added `UpdatePlanningParams` type with `Maybe` fields for partial updates. Added `requestUpdatePlanning` handler that uses `Registry.updateTask` with `Maybe.withDefault` to merge only present fields.
- `src/chorus/src/Main.gren` - Added `parseUpdatePlanningBody` using `Decode.map4` with `Decode.maybe` for each field. Added route handling for `UpdateTaskPlanning` in `handleRoute`.
- `src/chorus-ui/src/Api.gren` - Added four planning fields to `Task` type. Updated `taskDecoder` with backward-compatible `Decode.oneOf` chains. Added `updateTaskPlanning` function that sends `PUT /api/tasks/:id/planning` with only the fields present in the params.
- `src/chorus-ui/src/Main.gren` - Added `PlanningEditState` model field. Added Msg variants: `EditPlanningSection`, `UpdatePlanningDraft`, `UpdatePlanningItemDraft`, `AddPlanningItem`, `RemovePlanningItem`, `SavePlanning`, `CancelPlanningEdit`, `PlanningUpdated`. Added update handlers for all variants. Wired planning props through to `TaskDetail.view`.
- `src/chorus-ui/src/View/TaskDetail.gren` - Defined `PlanningSection` type and `PlanningEditState` type alias (exported for use by Main). Extended `Props` with editing state and callbacks. Added `viewPlanningSections` rendering Summary (text/textarea), Requirements, Acceptance Criteria, and Plan (numbered lists with per-item textarea editing, add/remove buttons). Added `sectionEquals` helper.
- `src/chorus-ui/static/styles.css` - Added styles for `.planning-sections`, `.planning-section`, `.planning-section-header`, `.planning-text`, `.planning-numbered-list`, `.empty-state-text`, `.planning-edit`, `.planning-textarea`, `.planning-item-list`, `.planning-item-edit`, `.planning-remove-btn`, `.planning-add-btn`, `.planning-edit-actions`.
- `src/chorus/tests/unit/RegistryTests.gren` - Added `testTaskEncodeDecodeWithPlanningFields` and `testTaskDecodeBackwardCompatibility` tests. Updated all existing test task records to include the four new fields with empty defaults.

## Build Status
**Status:** PASS

```
npm run build:all completed without errors.
All modules compiled (UI: 6 modules, Tools: 4 modules, Chorus: 8 modules).
Docker image built.
```

## Test Status
**Status:** PASS

```
Running 23 tests...
23 passed, 0 failed

Running 18 integration tests...
18 passed, 0 failed
```

## Implementation Notes
- In Gren, union type variants can have at most 1 parameter. The `UpdatePlanningItemDraft` Msg variant was changed to accept `{ index : Int, value : String }` instead of two separate parameters.
- The `PlanningSection` and `PlanningEditState` types are defined in `View.TaskDetail` and imported by `Main` to avoid circular dependencies (Main imports TaskDetail, not the other way around).
- The `taskDecoder` in both backend and frontend uses chained `Decode.andThen` with `Decode.oneOf` for backward compatibility. Each new field falls back to its empty default if not present in the JSON.
- The `updateTaskPlanning` frontend function only includes fields in the request body that have `Just` values, so omitted fields are not sent at all. The backend uses `Decode.maybe (Decode.field ...)` so missing JSON fields decode to `Nothing`, and the handler uses `Maybe.withDefault` to keep existing values unchanged.
- The `TaskSummary` type is not modified, as specified in the task requirements.

## Iteration
1
