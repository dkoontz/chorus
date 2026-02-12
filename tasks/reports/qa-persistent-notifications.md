# QA Report: Persistent Error Notifications with Stacking

## Summary

The notification system implementation passes build and all tests (62 unit, 19 integration). Code review confirms all acceptance criteria are met: the old `error : Maybe String` model field and `ClearError` message have been fully replaced with a notification system supporting stacking, persistent errors, and auto-dismissing success messages. Browser-based functional testing could not be performed because the Chrome browser extension was unavailable during this QA session.

## Test Scenarios

### Scenario 1: Build succeeds
- **Description:** Verify the app compiles with the new Notification module and all changes
- **Steps:**
  1. Run `npm run build:all`
- **Expected:** Build completes without errors
- **Actual:** Build completed successfully, all 13 UI modules compiled
- **Status:** PASS

### Scenario 2: All tests pass
- **Description:** Verify unit and integration tests pass
- **Steps:**
  1. Run `npm run test`
- **Expected:** All tests pass
- **Actual:** 62 unit tests passed, 19 integration tests passed
- **Status:** PASS

### Scenario 3: Old error system fully removed
- **Description:** Verify no remnants of the old `error : Maybe String` system remain
- **Steps:**
  1. Search for `ClearError` in UI source
  2. Search for `error = Just` in UI source
  3. Search for `error = Nothing` in UI source
  4. Search for `viewError` in UI source
  5. Search for `.error-banner` in CSS
- **Expected:** No matches found for any of these patterns
- **Actual:** No matches found -- all old error patterns completely removed
- **Status:** PASS

### Scenario 4: All error sites converted to notifications
- **Description:** Verify every error display site from the spec uses `addErrorNotification`
- **Steps:**
  1. Cross-reference the 22 error sites listed in the task spec with `addErrorNotification` calls in Main.gren
- **Expected:** All 22 sites converted
- **Actual:** All 22 error sites are converted to `addErrorNotification` calls, including HTTP errors (GotTasks, GotTask, TaskCreated, StatusUpdated, FileUploaded, AttachmentDeleted, PlanningUpdated, GotAgents, GotAgentSaved, GotAgentDeleted, GotProviders, GotProviderSaved, GotProviderDeleted, HandoffStarted, AnswersSubmitted, SettingsSaved) and validation errors (empty task description, empty agent name, empty provider name, "Select an agent", empty workspace path, empty directory path)
- **Status:** PASS

### Scenario 5: All success notification sites added
- **Description:** Verify success notifications are added for key operations
- **Steps:**
  1. Search for `addSuccessNotification` calls in Main.gren
  2. Cross-reference with the 6 success sites in the spec
- **Expected:** 6 success notification sites: TaskCreated, GotAgentSaved, GotAgentDeleted, GotProviderSaved, GotProviderDeleted, SettingsSaved
- **Actual:** All 6 present: "Task created" (line 440), "Agent saved" (line 853), "Agent deleted" (line 870), "Provider saved" (line 1055), "Provider deleted" (line 1072), "Settings saved" (line 1547)
- **Status:** PASS

### Scenario 6: Notification module uses opaque type
- **Description:** Verify the Notification type is opaque with smart constructors
- **Steps:**
  1. Check module exposing clause in Notification.gren
  2. Verify `Notification` is exposed without constructors
  3. Verify smart constructors `error` and `success` are exposed
- **Expected:** Opaque `Notification` type with `error` and `success` constructors exposed
- **Actual:** `Notification` is opaque (no constructor export), `Level(..)` exports constructors, smart constructors `error` and `success` are exposed along with `notificationId`, `isExpired`, and `viewNotifications`
- **Status:** PASS

### Scenario 7: Error notifications never auto-expire
- **Description:** Verify that error notifications return `False` from `isExpired`
- **Steps:**
  1. Review `isExpired` function in Notification.gren
- **Expected:** Error notifications always return `False` for isExpired
- **Actual:** `isExpired` pattern-matches on level; `Error -> False` (line 60), meaning errors never expire
- **Status:** PASS

### Scenario 8: Success notifications expire after ~5 seconds
- **Description:** Verify success notifications auto-dismiss via the poll cycle
- **Steps:**
  1. Review `isExpired` function: `Success -> Time.posixToMillis now - Time.posixToMillis notification.createdAt > 5000`
  2. Review Poll handler: filters notifications using `Array.keepIf (\n -> not (Notification.isExpired now n))`
  3. Poll runs every 2000ms
- **Expected:** Success notifications expire after 5000ms + up to 2000ms poll interval
- **Actual:** Implementation correctly checks `now - createdAt > 5000` for Success notifications. With 2-second polling, actual dismiss time is 5-7 seconds, which matches the spec's "~5 seconds"
- **Status:** PASS

### Scenario 9: Close button dismisses individual notifications
- **Description:** Verify the DismissNotification handler removes only the targeted notification
- **Steps:**
  1. Review DismissNotification handler in Main.gren
  2. Verify it filters by notification ID
- **Expected:** Only the notification matching the ID is removed
- **Actual:** Handler uses `Array.keepIf (\n -> Notification.notificationId n /= id) model.notifications` which correctly removes only the targeted notification
- **Status:** PASS

### Scenario 10: Multiple notifications stack vertically
- **Description:** Verify notifications render in a stacking container
- **Steps:**
  1. Review `viewNotifications` function in Notification.gren
  2. Review `.notification-stack` CSS class
- **Expected:** Notifications rendered in a flex column container
- **Actual:** `viewNotifications` wraps notifications in `div [ class "notification-stack" ]` with `Array.map viewNotification`. CSS defines `.notification-stack { display: flex; flex-direction: column; }` for vertical stacking
- **Status:** PASS

### Scenario 11: settingsValidationError preserved
- **Description:** Verify SystemSettings inline validation is unaffected
- **Steps:**
  1. Run `git diff HEAD -- packages/chorus-ui/src/View/SystemSettings.gren`
  2. Search for `settingsValidationError` in Main.gren
- **Expected:** No changes to SystemSettings.gren; settingsValidationError still used in Main.gren
- **Actual:** SystemSettings.gren has zero changes. Main.gren still declares, initializes, and uses `settingsValidationError` in 7 places
- **Status:** PASS

### Scenario 12: Success handlers no longer clear errors
- **Description:** Verify that success responses from polling (GotTasks Ok, GotTask Ok, etc.) do not clear notifications
- **Steps:**
  1. Review GotTasks Ok handler -- should not modify `notifications`
  2. Review GotTask Ok handler -- should not modify `notifications`
  3. Review other Ok handlers (StatusUpdated, FileUploaded, AttachmentDeleted, etc.)
- **Expected:** Success handlers only update their relevant model fields, not notifications
- **Actual:** All success handlers use standard record update syntax without touching `notifications`. For example, `GotTasks Ok` sets `{ model | tasks = tasks, loading = False }` with no notification manipulation
- **Status:** PASS

### Scenario 13: View placement correct
- **Description:** Verify notifications render between header and main content
- **Steps:**
  1. Review `view` function in Main.gren
- **Expected:** `Notification.viewNotifications` called between `viewHeader` and `viewMain`
- **Actual:** View body is `[ viewHeader model, Notification.viewNotifications model.notifications DismissNotification, viewMain model ]` -- correctly positioned
- **Status:** PASS

### Scenario 14: App serves correctly with notification system
- **Description:** Verify the app starts and serves the UI with the new code
- **Steps:**
  1. Start app with `npm run start`
  2. Curl http://localhost:8080/ to verify HTML is served
  3. Check that app.js contains notification-related compiled code
- **Expected:** App starts, HTML loads, compiled JS includes notification system
- **Actual:** App started and served HTML. Compiled app.js contains `notification-stack`, `notification--error`, `notification--success`, `DismissNotification`, `addErrorNotification`, `addSuccessNotification`, `isExpired`, and `viewNotifications` functions
- **Status:** PASS

### Scenario 15: Browser-based functional testing (error persistence, stacking, close button, auto-dismiss)
- **Description:** Interact with the UI in a browser to verify notification behavior
- **Steps:**
  1. Attempt to connect Chrome browser extension
- **Expected:** Navigate to UI, trigger errors and success notifications, verify visual behavior
- **Actual:** Chrome browser extension was not connected/available during this QA session. Browser-based functional testing could not be performed.
- **Status:** INCOMPLETE (not a code issue -- testing environment limitation)

## Failures

No code failures found. All acceptance criteria are met based on build results, test results, and code review.

## Test Code Quality Issues

No new test files were added or modified. The existing 62 unit tests and 19 integration tests pass.

## Integration Tests Added

No integration tests were added. The `QA_STANDARDS.md` integration test framework is designed for `packages/tools/` (file tools, handoff tools, task tools), which test CLI tool JSON input/output scenarios. This feature is a UI-only change (Gren/Elm front-end notification system) with no new tool endpoints, API changes, or backend logic. The notification system operates entirely in the browser via the Gren runtime. UI behavior verification requires browser-based testing, not tool-level integration tests.

## Code Quality Observations

1. **Auto-dismiss implementation differs from spec:** The spec suggested `Process.sleep 5000 |> Task.perform` for auto-dismiss. The implementation instead uses an `isExpired` check during the poll cycle (every 2 seconds). This is a simpler, valid approach that avoids spawning commands for each notification. The effective auto-dismiss time is 5-7 seconds, matching the spec's "~5 seconds" requirement.

2. **Module API is minimal:** The spec suggested `message`, `level`, and `isAutoDismiss` accessors, but the implementation only exposes what's actually used by consumers: `notificationId`, `isExpired`, `error`, `success`, and `viewNotifications`. This is appropriate -- unused API surface would be dead code.

3. **Close button character:** The close button uses Unicode multiplication sign (`\u{00D7}`) instead of a plain "x", which is a visual improvement over the old implementation's plain "x" character.

4. **Modal click propagation:** The create-task modal's click-to-stop-propagation handler was updated from `ClearError` to `NoOp`, which is correct since clicking the modal body should not affect notifications.

## Overall Assessment

**Decision:** PASS

All acceptance criteria are verified through build, tests, and code review:
- Error notifications persist (never expire via `isExpired`)
- Error notifications survive poll cycle (success handlers don't clear notifications)
- Success notifications auto-dismiss after ~5-7 seconds (via `isExpired` check in Poll handler)
- Multiple notifications stack vertically (via `notification-stack` container)
- All existing error sites converted to notification system (22 error sites, 6 success sites)
- Settings validation error display unchanged (SystemSettings.gren untouched)
- App builds successfully
- All tests pass (62 unit + 19 integration)

**Non-blocking note:** Browser-based functional testing was not performed due to Chrome extension unavailability. The code review is thorough and covers all logic paths, but visual verification of notification rendering, close button interaction, and auto-dismiss timing in a real browser should be confirmed separately.
