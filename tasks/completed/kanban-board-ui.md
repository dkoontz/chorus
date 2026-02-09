# Kanban Board UI

## Summary

Replace the Dashboard and Task List pages with a single kanban board view that displays tasks as cards organized into columns by status, similar to Trello or a project board.

**Depends on:** `tasks/agent-handoff-tracking.md` -- provides `currentAgent` and `agentChain` fields on tasks and `TaskSummary`, which this task uses to display agent info on cards.

## Requirements

### Part 1: Remove existing Dashboard and Task List pages

- Remove the `DashboardPage` and `TaskListPage` variants from the `Page` type in `Main.gren`
- Replace them with a single `BoardPage` variant
- Update `urlToPage` so that both `/` and `/tasks` route to `BoardPage`
- Update the nav bar to show a single "Board" link instead of separate "Dashboard" and "Tasks" links
- Remove or repurpose `View/Dashboard.gren` and `View/TaskList.gren` (they can be deleted since the new board view replaces both)
- Keep the `TaskDetailPage` variant and all its behavior unchanged

### Part 2: Create the kanban board view

- Create a new file `packages/chorus-ui/src/View/Board.gren` with a `view` function
- The board displays five columns, one per status: **Pending**, **Active**, **Waiting**, **Completed**, **Failed**
- Each column has a header showing the status name and a count of tasks in that column (e.g., "Active (3)")
- Tasks are rendered as cards within the column matching their status
- Cards are sorted within each column by `updatedAt` descending (most recently updated at the top)
- The columns are laid out horizontally and scroll horizontally if the viewport is too narrow to show all five

### Part 3: Task card content

Each card displays:
- **Description** text (truncated to 2-3 lines with CSS line-clamp, same as the current `.task-description-truncate` pattern)
- **Summary** line beneath the description, shown only for planned tasks (truncated to 1 line). If the task is not planned or summary is empty, omit this line.
- **Current agent** label showing which agent is working on the task (e.g., "developer", "qa"), if one is active. Read from `currentAgent` on `TaskSummary`. If `Nothing`, omit this line.
- **Agent count** showing how many agent hand-offs have occurred (e.g., "3 hand-offs"). Derived from `Array.length (taskAgentChain task)` on the full task record. If 0, omit. Higher counts signal the task has gone back and forth between agents many times.
- **Source** badge showing `sourceType / userId` (e.g., "web / anonymous")
- **Updated** timestamp showing the `updatedAt` value
- The entire card is a clickable link that navigates to `/tasks/:id` (the existing task detail page)

### Part 4: Wire the board into Main.gren

- Import `View.Board as Board` in `Main.gren`
- In `viewMain`, render `Board.view` for the `BoardPage` page variant
- The Board view needs the `tasks` array and `loading` flag from the model
- Polling behavior stays the same: `Poll` fetches tasks via `Api.getTasks` for the board page
- The create task modal (+ New Task button and modal) remains functional and accessible from the board page
- The status filter dropdown is removed (the board itself groups by status, making a filter redundant)
- Remove `SetStatusFilter` message handling and `statusFilter` from the model (no longer needed)

### Part 5: Styles

- Add CSS styles in `styles.css` for:
  - `.kanban-board` -- horizontal flex container for columns, with `overflow-x: auto` for narrow viewports
  - `.kanban-column` -- vertical flex container, fixed minimum width (~240px), background color slightly different from the page background
  - `.kanban-column-header` -- column title and count, styled with the status color (using existing `--status-*` CSS variables)
  - `.kanban-card` -- white card with border, border-radius, padding, subtle shadow, hover effect. Uses existing `.card`-like styling
  - `.kanban-card:hover` -- subtle elevation change or border color change to indicate clickability
  - `.kanban-card a` -- unstyled link wrapping the card content (no underline, inherit text color)
  - `.kanban-card-description` -- truncated task description (reuse the `line-clamp` pattern)
  - `.kanban-card-summary` -- single-line truncated summary, smaller font, secondary text color
  - `.kanban-card-agent` -- current agent label, small badge/pill style (e.g., colored label showing "developer")
  - `.kanban-card-handoff-count` -- agent hand-off count, small secondary text
  - `.kanban-card-meta` -- bottom section of card showing source and timestamp in smaller text
  - Responsive: on viewports narrower than the total column width, allow horizontal scroll rather than stacking columns vertically
- Update `.main` max-width: change from `1200px` to `100%` with horizontal padding, since the board benefits from using available width
- Remove CSS rules that are only used by the deleted Dashboard and Task List views (`.stats-grid`, `.stat-card`, `.stat-value`, `.stat-label`, `.stat-*` status variants, `.task-list-page`, `.task-list-header`, `.filter-dropdown`, `.task-table`, `.task-row`, `.task-description-cell`, `.source-info`, `.timestamp`, `.action-buttons`). The `.status-badge` styles should be kept since they are used on the task detail page.

## Acceptance Criteria

- [ ] Navigating to `/` shows the kanban board
- [ ] Navigating to `/tasks` shows the same kanban board
- [ ] The board has five columns: Pending, Active, Waiting, Completed, Failed
- [ ] Each column header shows the status name and count of tasks in that column
- [ ] Tasks appear as cards in the column matching their status
- [ ] Cards show the task description (truncated), source info, and updated timestamp
- [ ] Cards for planned tasks also show the summary text (truncated to one line)
- [ ] Cards show the current agent name when one is active (from `TaskSummary.currentAgent`)
- [ ] Cards show the agent hand-off count when > 0 (derived from `agentChain` length)
- [ ] Clicking a card navigates to `/tasks/:id` (the task detail page)
- [ ] Cards within each column are sorted by `updatedAt` descending
- [ ] The "+ New Task" button and create task modal still work from the board page
- [ ] The nav bar shows a single "Board" link (not separate "Dashboard" and "Tasks" links)
- [ ] Polling continues to refresh tasks every 2 seconds on the board page
- [ ] The board scrolls horizontally on narrow viewports
- [ ] The task detail page (`/tasks/:id`) is unchanged and still works
- [ ] `npm run build:all` completes without errors

## Out of Scope

- Drag-and-drop between columns to change task status
- Action buttons on cards (start, pause, complete, etc.)
- Filtering or searching tasks on the board
- Collapsible columns
- Creating tasks from within a specific column
- Any backend/API changes (agent tracking fields are provided by `tasks/agent-handoff-tracking.md`)

## Technical Context

### Files to Modify

- `packages/chorus-ui/src/Main.gren` -- Replace `DashboardPage`/`TaskListPage` with `BoardPage`, update `urlToPage`, update `viewMain`, update `viewHeader` nav links, remove `statusFilter` from Model and `SetStatusFilter` from Msg, update `Poll` handler
- `packages/chorus-ui/src/View/Board.gren` -- New file: kanban board view with columns and cards
- `packages/chorus-ui/static/styles.css` -- Add kanban board styles, remove unused Dashboard/TaskList styles, update `.main` max-width

### Files to Delete

- `packages/chorus-ui/src/View/Dashboard.gren` -- Replaced by Board view
- `packages/chorus-ui/src/View/TaskList.gren` -- Replaced by Board view

### Related Files (reference only)

- `packages/shared/Types.gren` -- Task type definition, `taskDescription`, `taskStatus`, `taskUpdatedAt`, `taskSource`, `statusToString`, `isPlanned`, `taskCurrentAgent`, `taskAgentChain` accessors
- `tasks/agent-handoff-tracking.md` -- Prerequisite task that adds `currentAgent` and `agentChain` to the data model
- `packages/chorus-ui/src/View/TaskDetail.gren` -- Task detail page (unchanged, cards link here)
- `packages/chorus-ui/src/Api.gren` -- `getTasks` function used to fetch task data
- `docs/reference-images/kanban-interface1.png` -- Trello-style reference: columns with simple cards showing title and colored labels
- `docs/reference-images/kanban-interface2.png` -- Project board reference: columns with cards showing title, assignee, and metadata

### Patterns to Follow

- Gren uses `when ... is` for pattern matching (not `case ... of`)
- HTML views follow the pattern: `view : Props -> Html msg` with a `Props` type alias
- CSS class names use kebab-case (e.g., `kanban-board`, `kanban-card`)
- Task accessors from `Types` module: `taskId`, `taskDescription`, `taskStatus`, `taskUpdatedAt`, `taskSource`, `isPlanned`, `statusToString`, `taskCurrentAgent`, `taskAgentChain`
- `TaskSummary` includes `currentAgent : Maybe String` (provided by the agent-handoff-tracking task). The hand-off count is derived from `agentChain` on the full task, not stored on `TaskSummary`.
- For planned task data, pattern match on `Planned t` to access `t.summary`
- Links use `a [ href ("/tasks/" ++ Types.taskId task) ]` for navigation
- Truncation uses the existing `-webkit-line-clamp` CSS pattern (see `.task-description-truncate`)
- Column count badge: use `Array.foldl` to count tasks per status (see `countByStatus` in the current Dashboard view)
- Status colors use the existing CSS variables: `--status-pending`, `--status-active`, `--status-waiting`, `--status-completed`, `--status-failed`

## Testing Requirements

- Manual test: load the app, verify the board appears at `/` with five columns
- Manual test: verify `/tasks` also shows the board (not a separate page)
- Manual test: create a task via the "+ New Task" button and confirm it appears in the Pending column
- Manual test: click a card and confirm it navigates to the task detail page
- Manual test: on the task detail page, click "Back to Tasks" and confirm it returns to the board
- Manual test: resize the browser window narrow enough to trigger horizontal scroll on the board
- Manual test: verify polling updates the board (change a task status via the detail page, return to board, confirm the card moves to the correct column within 2 seconds)
- Manual test: verify cards show the current agent name when one is active
- Manual test: verify cards show the hand-off count when > 0
- Build test: `npm run build:all` completes without errors

## Notes

- The `statusFilter` field in the Model and `SetStatusFilter` message become unnecessary since the board groups tasks by status visually. Remove them to avoid dead code.
- The `loadPageData` function should fetch all tasks (no status filter) for the `BoardPage`, same as the current `DashboardPage` behavior.
- The Failed column should still be visible even when empty, same as all columns. Empty columns show a subtle empty state (e.g., "No tasks" in secondary text).
- The "Back to Tasks" link on the task detail page (`/tasks`) will now navigate back to the board.
- The `formatTimestamp` function in the current views just renders the raw milliseconds as a string. The board cards should use the same approach for consistency (improving timestamp formatting is a separate concern).
