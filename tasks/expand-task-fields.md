# Expand Task Type with Structured Planning Fields

## Summary

Add four new fields to the Task type -- `summary`, `requirements`, `acceptanceCriteria`, and `plan` -- that give agents structured context for task execution. The web UI will display these fields on the task detail page and allow the user to edit them inline.

## Dependencies

This task must be completed after `task-description-and-attachments.md`, which renames `title` to `description`, adds `attachments`, and restructures the task decoder from `Decode.map8` to a pipeline approach. The new fields in this task build on top of that restructured decoder. Assume the Task type already has `description` (not `title`) and an `attachments` array by the time this task is implemented.

## Requirements

### Part 1: Backend -- Task type changes

- Add `summary : String` field to the `Task` type alias in `Task.Registry` (default: empty string)
- Add `requirements : Array String` field to the `Task` type alias in `Task.Registry` (default: empty array)
- Add `acceptanceCriteria : Array String` field to the `Task` type alias in `Task.Registry` (default: empty array)
- Add `plan : Array String` field to the `Task` type alias in `Task.Registry` (default: empty array)
- Encode all four fields in `encodeTask` using JSON keys `"summary"`, `"requirements"`, `"acceptanceCriteria"`, and `"plan"`
- Decode all four fields in `taskDecoder` with backward-compatible defaults using `Decode.oneOf` (so existing task.json files without these fields decode with empty string / empty array)
- These fields are NOT added to `TaskSummary` -- they are only available on the full `Task` record
- The `createTask` function initializes these fields to their empty defaults

### Part 2: Backend -- API endpoint

- Add an `UpdateTaskPlanning String` variant to the `Route` union type in `Web.Router`
- Add route parsing for `PUT /api/tasks/:id/planning` in `parseRoute`
- Define an `UpdatePlanningParams` type in `Web.Api`:
  ```
  { summary : Maybe String
  , requirements : Maybe (Array String)
  , acceptanceCriteria : Maybe (Array String)
  , plan : Maybe (Array String)
  }
  ```
- Add a `requestUpdatePlanning` handler in `Web.Api` that:
  - Uses `Registry.updateTask` to merge the provided fields into the existing task
  - Only updates fields that are present in the request body (partial update)
  - Fields set to `Nothing` in the params are left unchanged on the task
  - Returns the updated task JSON wrapped in the standard response format
- Add `parseUpdatePlanningBody` in `Main.gren` to decode the request body into `UpdatePlanningParams`
  - Each field is optional: use `Decode.maybe (Decode.field "summary" Decode.string)` etc.
- Add route handling for `UpdateTaskPlanning` in `handleRoute` in `Main.gren`
- Add `routeToString` entry for `UpdateTaskPlanning` in `Web.Router`

### Part 3: Frontend -- Api module

- Add `summary : String`, `requirements : Array String`, `acceptanceCriteria : Array String`, and `plan : Array String` fields to the `Task` type alias in `Api`
- Update `taskDecoder` to decode these four fields with backward-compatible defaults (empty string / empty array)
- Add an `updateTaskPlanning` function that sends `PUT /api/tasks/:id/planning` with a JSON body containing the fields to update

### Part 4: Frontend -- Task detail view

- On the task detail page, display four new sections below the existing task info:
  - **Summary** -- shows the summary text, or "No summary" placeholder if empty
  - **Requirements** -- shows a numbered list of requirements, or "No requirements" placeholder
  - **Acceptance Criteria** -- shows a numbered list of acceptance criteria, or "No acceptance criteria" placeholder
  - **Plan** -- shows a numbered list of plan steps, or "No plan" placeholder
- Each section has an "Edit" button that switches to edit mode:
  - Summary edit mode: a `<textarea>` with save/cancel buttons
  - Requirements / Acceptance Criteria / Plan edit mode: a list of `<textarea>` elements (one per item) with add/remove buttons per item, plus save/cancel buttons
- Add Msg variants to `Main.gren` for:
  - Entering/exiting edit mode for each section
  - Updating the draft content during editing
  - Saving changes (calls `Api.updateTaskPlanning`)
  - Handling the save response
- Add editing state to the `Model` to track which section is being edited and the draft values
- Wire the new Props through to `View.TaskDetail`

### Part 5: Styles

- Add CSS styles in `styles.css` for:
  - Planning sections container and individual section cards
  - Section headers with edit buttons
  - Numbered lists for requirements/criteria/plan
  - Edit mode textarea styling
  - Add/remove item buttons
  - Save/cancel button group
  - Empty state placeholder text

## Acceptance Criteria

- [ ] The `Task` type in `Task.Registry` includes `summary`, `requirements`, `acceptanceCriteria`, and `plan` fields
- [ ] The JSON keys are `"summary"`, `"requirements"`, `"acceptanceCriteria"`, and `"plan"`
- [ ] Existing task.json files without these fields decode correctly (empty defaults)
- [ ] `PUT /api/tasks/:id/planning` with `{"summary": "..."}` updates the summary field
- [ ] `PUT /api/tasks/:id/planning` with `{"requirements": ["a", "b"]}` updates requirements
- [ ] `PUT /api/tasks/:id/planning` with `{"acceptanceCriteria": ["x"]}` updates acceptance criteria
- [ ] `PUT /api/tasks/:id/planning` with `{"plan": ["step 1", "step 2"]}` updates the plan
- [ ] Partial updates work (sending only `summary` does not clear `requirements`)
- [ ] The task detail page displays Summary, Requirements, Acceptance Criteria, and Plan sections
- [ ] Each section has an edit mode allowing the user to modify the content
- [ ] The frontend `Api.Task` type includes the four new fields
- [ ] Unit tests verify encode/decode round-trip with all new fields
- [ ] Unit tests verify backward-compatible decoding (missing fields default to empty)
- [ ] All existing tests pass after the changes
- [ ] `npm run build:all` completes without errors

## Out of Scope

- Renaming `title` to `description` (handled by `task-description-and-attachments` task)
- Adding `attachments` (handled by `task-description-and-attachments` task)
- Markdown rendering of plan/requirements content in the UI
- Drag-and-drop reordering of list items
- Versioning or change history for planning fields
- Auto-generation of these fields by AI (that is the consumer of these fields, not this task)
- Adding planning fields to the `TaskSummary` type or the task list table

## Technical Context

### Files to Modify

**Backend (src/chorus/):**
- `src/chorus/src/Task/Registry.gren` - Add four fields to `Task` type, update `encodeTask`, update `taskDecoder` with backward-compatible decoding, update `createTask` to initialize fields to empty defaults
- `src/chorus/src/Web/Router.gren` - Add `UpdateTaskPlanning String` route variant, add route parsing for `PUT /api/tasks/:id/planning`, add `routeToString` entry
- `src/chorus/src/Web/Api.gren` - Add `UpdatePlanningParams` type, add `requestUpdatePlanning` handler
- `src/chorus/src/Main.gren` - Add `parseUpdatePlanningBody` parser, add route handling for `UpdateTaskPlanning` in `handleRoute`

**Frontend (src/chorus-ui/):**
- `src/chorus-ui/src/Api.gren` - Add four fields to `Task` type, update `taskDecoder`, add `updateTaskPlanning` function
- `src/chorus-ui/src/Main.gren` - Add Msg variants for editing planning fields (`EditPlanningSection`, `UpdatePlanningDraft`, `SavePlanning`, `PlanningUpdated`, `CancelPlanningEdit`, `AddPlanningItem`, `RemovePlanningItem`), add editing state to Model, wire new Props to `TaskDetail.view`
- `src/chorus-ui/src/View/TaskDetail.gren` - Add `viewPlanningSections` with Summary, Requirements, Acceptance Criteria, Plan sections; add edit mode views; extend `Props` with editing callbacks

**Styles:**
- `src/chorus-ui/static/styles.css` - Add styles for planning sections, edit mode, list items, add/remove buttons

**Tests:**
- `src/chorus/tests/unit/RegistryTests.gren` - Add `testTaskEncodeDecodeWithPlanningFields`, add `testTaskDecodeBackwardCompatibility`, update existing test helpers to include new fields

### Related Files (reference only)
- `tasks/task-description-and-attachments.md` - Prerequisite task that renames `title` to `description` and restructures the decoder
- `src/chorus/src/Task/Queue.gren` - Reference for file I/O patterns
- `src/chorus/src/Web/Static.gren` - Reference for response patterns

### Patterns to Follow

- Gren uses `when ... is` for pattern matching (not `case ... of`)
- Record updates: `{ model | field = value }`
- JSON encoding uses `Encode.object [ { key = "...", value = ... } ]`
- JSON decoding uses `Decode.field "key" decoder` and `Decode.mapN` combinators
- Use `Decode.oneOf` with a fallback for backward-compatible decoding of optional fields (e.g., decode `summary` or default to `""`)
- Use `Decode.andThen` to decode beyond 8 fields (since `Decode.map8` is the maximum in Gren). The prerequisite task will have already restructured the decoder to use a pipeline approach -- follow that pattern.
- API handlers follow: `requestXxx : ApiContext -> ... -> (ApiResult -> msg) -> Cmd msg`
- Routes are union type variants in `Web.Router.Route`
- Atomic file writes use `writeFileAtomic`
- Response wrapping uses `wrapResponse` for `{ data: ..., meta: { timestamp: ... } }` format
- For partial update params, use `Maybe` fields and merge with existing task values using `Maybe.withDefault existingValue maybeNewValue`

## Testing Requirements

- Add `testTaskEncodeDecodeWithPlanningFields` -- create a task record with all four fields populated, encode to JSON, decode back, verify all fields match
- Add `testTaskDecodeBackwardCompatibility` -- encode a task JSON string that omits the four new fields entirely, decode it, verify all four fields default to empty values
- Update `testStatusRoundTrip` helper to include the new fields in its test task record
- Update `testSourceInfoEncodeDecode` to include the new fields in its test task record
- All existing tests must continue to pass without modification to their assertions
- Manual test: view a task detail page and verify all four planning sections appear
- Manual test: edit the summary text and save, then refresh the page and verify it persists
- Manual test: add items to requirements, remove an item, save, and verify the changes persist
- Manual test: verify that editing one section does not affect other sections (partial update)

## Notes

- The `summary` field is a plain string (not an array) since it is typically 1-2 sentences of free text.
- The `plan` field uses `Array String` where each string is one step. Steps can contain multi-line text but each array element represents one logical step.
- The `acceptanceCriteria` field uses `Array String` where each string is one criterion.
- The `requirements` field uses `Array String` where each string is one requirement.
- The editing UI for the `summary` field uses a single `<textarea>`. The editing UI for array fields (`requirements`, `acceptanceCriteria`, `plan`) uses a list of `<textarea>` elements with add/remove buttons per item.
- The `UpdatePlanningParams` type uses `Maybe` for each field so that partial updates are possible. Only fields present in the request body are updated; omitted fields are left unchanged on the task.
- The four new fields do not appear in `TaskSummary` or in the task list table. They are only relevant on the full task detail view.
