# QA Report

## Summary

The kanban board UI implementation meets all functional requirements. The board displays five columns by status, cards show the required information (description, agent, hand-offs, source, timestamp), routing works for both `/` and `/tasks`, the create task modal functions correctly, and polling keeps the board updated. One minor grammar issue was found. No blocking issues.

## Test Scenarios

### Scenario 1: Board renders at root URL

- **Description:** Navigating to `/` should show the kanban board with five columns.
- **Steps:**
  1. Navigate to `http://localhost:8080/`
  2. Observe the page content
- **Expected:** A kanban board with columns for Pending, Active, Waiting, Completed, and Failed.
- **Actual:** Board renders with all five columns, each showing a header with status name and task count badge.
- **Status:** PASS

### Scenario 2: Board renders at /tasks URL

- **Description:** Navigating to `/tasks` should show the same kanban board.
- **Steps:**
  1. Navigate to `http://localhost:8080/tasks`
  2. Observe the page content
- **Expected:** The same kanban board as `/`.
- **Actual:** Identical kanban board displayed.
- **Status:** PASS

### Scenario 3: Column headers show status name and count

- **Description:** Each column header displays the status name in uppercase and a count badge.
- **Steps:**
  1. Navigate to the board
  2. Inspect column headers
- **Expected:** Headers like "PENDING 4", "ACTIVE 3", etc.
- **Actual:** Each column shows an uppercase status name and a rounded count badge. The spec example used parenthesized format ("Active (3)") but the badge approach conveys the same information.
- **Status:** PASS

### Scenario 4: Cards display task description

- **Description:** Each card shows the task description text, truncated if long.
- **Steps:**
  1. View cards on the board
  2. Verify descriptions are visible and truncated via CSS line-clamp
- **Expected:** Description text truncated to 2-3 lines.
- **Actual:** Descriptions are shown and truncated to 3 lines via `-webkit-line-clamp: 3` CSS.
- **Status:** PASS

### Scenario 5: Cards show current agent when active

- **Description:** Cards with a `currentAgent` value display a pill badge with the agent name.
- **Steps:**
  1. Identify cards with a current agent (e.g., "QA iteration 3 test task", "QA handoff test task")
  2. Verify the agent name appears as a badge
- **Expected:** Blue pill badge showing "qa".
- **Actual:** Blue pill badge with "qa" text is displayed on cards that have a current agent. Cards without a current agent omit the badge.
- **Status:** PASS

### Scenario 6: Cards show hand-off count when > 0

- **Description:** Cards with agent hand-offs show the count.
- **Steps:**
  1. Identify cards with hand-offs (e.g., "Handoff e2e test" with 2 hand-offs)
  2. Verify the count is displayed
- **Expected:** Text like "2 hand-offs" shown on the card.
- **Actual:** Hand-off count is shown correctly. Cards with 0 hand-offs omit the line. Note: "1 hand-offs" uses plural form even for count of 1 (minor grammar issue).
- **Status:** PASS

### Scenario 7: Cards show source info and timestamp

- **Description:** Each card displays source type / userId and an updated timestamp.
- **Steps:**
  1. Inspect the bottom metadata section of any card
- **Expected:** Source info (e.g., "web / anonymous") and a timestamp.
- **Actual:** Source info and raw millisecond timestamp are displayed in a meta section at the bottom of each card, separated by a top border line.
- **Status:** PASS

### Scenario 8: Clicking a card navigates to task detail

- **Description:** Clicking a card should navigate to `/tasks/:id`.
- **Steps:**
  1. Click on the "Clean task for unknown agent test" card in the Pending column
  2. Observe the URL and page content
- **Expected:** Navigation to `/tasks/<task-id>` with the task detail page.
- **Actual:** Navigated to `/tasks/4c98edac-38f2-433c-a1ba-0160cc3c2a3e` and the task detail page rendered correctly with task info, planning, attachments, and history sections.
- **Status:** PASS

### Scenario 9: Back to Tasks returns to the board

- **Description:** The "< Back to Tasks" link on the task detail page should return to the board.
- **Steps:**
  1. From a task detail page, click "< Back to Tasks"
  2. Observe the resulting page
- **Expected:** Board page at `/tasks`.
- **Actual:** Navigated back to `/tasks` and the kanban board is displayed.
- **Status:** PASS

### Scenario 10: Create task modal works from the board

- **Description:** The "+ New Task" button opens a modal, and creating a task adds it to the Pending column.
- **Steps:**
  1. Click "+ New Task" button
  2. Type "QA test task created from kanban board" in the description textarea
  3. Click "Create"
  4. Observe the board
- **Expected:** Modal closes and the new task appears in the Pending column.
- **Actual:** Modal opened, accepted input, and after clicking Create, the modal closed and the new task appeared at the top of the Pending column (most recently updated). Pending count increased from 4 to 5.
- **Status:** PASS

### Scenario 11: Polling updates the board after status change

- **Description:** Changing a task's status via the detail page should be reflected on the board after polling.
- **Steps:**
  1. Click on the newly created task card in the Pending column
  2. Click "Start Task" to change status to Active
  3. Click "< Back to Tasks" to return to the board
  4. Observe the board
- **Expected:** The task moves from the Pending column to the Active column. Counts update.
- **Actual:** The task appeared at the top of the Active column. Pending count went from 5 to 4, Active from 3 to 4.
- **Status:** PASS

### Scenario 12: Horizontal scroll on narrow viewport

- **Description:** On narrow viewports, the board should scroll horizontally rather than stacking columns.
- **Steps:**
  1. Resize the browser window to 600px wide
  2. Observe the board layout
- **Expected:** Columns remain horizontal with a horizontal scrollbar.
- **Actual:** Pending and Active columns are fully visible, Waiting column is partially visible (clipped), confirming horizontal scroll is available. Columns do not stack vertically.
- **Status:** PASS

### Scenario 13: Nav bar shows single Board link

- **Description:** The nav bar should show only a "Board" link, not separate "Dashboard" and "Tasks" links.
- **Steps:**
  1. Inspect the nav bar on the board page
- **Expected:** Single "Board" link, no "Dashboard" or "Tasks" links.
- **Actual:** Only "Chorus" logo and "Board" link are present in the nav.
- **Status:** PASS

### Scenario 14: Cards sorted by updatedAt descending

- **Description:** Within each column, cards should be sorted by updatedAt descending (most recent at top).
- **Steps:**
  1. Read the timestamps on cards in the Pending column top to bottom
  2. Verify they are in descending order
- **Expected:** Timestamps decrease from top to bottom.
- **Actual:** Pending column: 1770603149822 > 1770597102663 > 1770517454677 > 1770517330874. Active column: 1770609755069 > 1770602932476 > 1770597126071 > 1770517352310. Both in correct descending order.
- **Status:** PASS

### Scenario 15: Empty column shows "No tasks" placeholder

- **Description:** Empty columns should display a "No tasks" message.
- **Steps:**
  1. Review the Board.gren code for empty state handling
  2. Observe columns on the board (all columns have at least 1 task currently)
- **Expected:** Empty columns show "No tasks" text.
- **Actual:** Code review confirms the `kanban-empty` div with "No tasks" text is rendered when a column has zero tasks. Could not test visually because all columns currently have tasks, but the code path is correct.
- **Status:** PASS

### Scenario 16: Not found page links to board

- **Description:** Navigating to an invalid URL shows a Not Found page with a "Go to Board" link.
- **Steps:**
  1. Navigate to `http://localhost:8080/nonexistent`
  2. Observe the page
  3. Click "Go to Board"
- **Expected:** Not Found page with link back to the board.
- **Actual:** "Page Not Found" message displayed with "Go to Board" link. Clicking the link navigated to `/` and the board displayed correctly.
- **Status:** PASS

### Scenario 17: Task detail page unchanged

- **Description:** The task detail page should still function as before.
- **Steps:**
  1. Click a card to navigate to a task detail page
  2. Verify task information, planning, attachments, and history sections are present
  3. Verify status action buttons work
- **Expected:** Full task detail page with all existing functionality.
- **Actual:** Task detail page renders with Task Information, Planning, Attachments, and History sections. Status change via "Start Task" button works correctly.
- **Status:** PASS

### Scenario 18: Build succeeds

- **Description:** `npm run build:all` should complete without errors.
- **Steps:**
  1. Run `npm run build:all`
- **Expected:** Build completes successfully.
- **Actual:** Build completed successfully. UI compiled 6 modules, tools and chorus compiled without errors.
- **Status:** PASS

### Scenario 19: All tests pass

- **Description:** `npm run test` should pass all unit and integration tests.
- **Steps:**
  1. Run `npm run test`
- **Expected:** All tests pass.
- **Actual:** 36 unit tests passed, 19 integration tests passed (55 total, 0 failures).
- **Status:** PASS

### Scenario 20: Summary display for planned tasks

- **Description:** Cards for planned tasks should show the summary text truncated to 1 line.
- **Steps:**
  1. Check API for planned tasks
  2. Verify summary display on their cards
- **Expected:** Summary text visible below description on planned task cards.
- **Actual:** No planned tasks exist in the current data set. Code review of `viewSummary` in Board.gren confirms correct implementation: it pattern-matches on `Planned t` to display `t.summary` when non-empty, using the `kanban-card-summary` CSS class with 1-line clamp. For `DescriptionOnly` tasks, it correctly renders nothing.
- **Status:** PASS (code review only; no live data to test against)

## Failures

No blocking failures found.

## Test Code Quality Issues

### Issue 1: Duplicate statusMatches function

- **File:** `packages/chorus-ui/src/View/Board.gren`
- **Line:** 156-174
- **Problem:** The `statusMatches` function in Board.gren is a duplicate of `Types.statusEquals` which is already exported from the shared Types module. The developer acknowledged this in their report.
- **Suggestion:** Replace `statusMatches` with `Types.statusEquals` to avoid duplication. This would reduce the Board module by ~20 lines and ensure any future changes to status comparison logic are centralized.

### Issue 2: Plural form "hand-offs" used for count of 1

- **File:** `packages/chorus-ui/src/View/Board.gren`
- **Line:** 143-147
- **Problem:** The `viewHandoffCount` function always uses "hand-offs" (plural) even when the count is 1, resulting in "1 hand-offs" being displayed.
- **Suggestion:** Add a conditional: `if count == 1 then "1 hand-off" else String.fromInt count ++ " hand-offs"`.

## Integration Tests Added

No integration test scenarios were applicable. The QA standards document describes integration tests for `packages/tools/` CLI tools using a JSON scenario format. This task modifies only the UI layer (Gren frontend code and CSS), which is outside the scope of the tools integration test framework. The UI behavior was verified through browser-based manual testing as documented above.

## Overall Assessment

**Decision:** PASS

All 17 acceptance criteria from the task specification are met:

- Both `/` and `/tasks` route to the kanban board
- Five columns displayed (Pending, Active, Waiting, Completed, Failed)
- Column headers show status name and count
- Cards display description, source info, timestamp, current agent, and hand-off count
- Planned task summary display is implemented correctly (verified via code review)
- Cards are clickable links to task detail pages
- Cards sorted by updatedAt descending within columns
- Create task modal works from the board page
- Nav bar shows single "Board" link
- Polling refreshes tasks every 2 seconds
- Horizontal scroll works on narrow viewports
- Task detail page is unchanged
- Build completes without errors

Non-blocking observations:

- The "1 hand-offs" grammar issue is minor and does not affect functionality
- The `statusMatches` duplication is a code quality concern but does not affect behavior
- No planned tasks were available to verify summary display in the browser, but code review confirms correct implementation
