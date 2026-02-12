# Persistent Error Notifications with Stacking

## Summary
Create a dedicated `Notification` module that supports stacking error and success notifications as top banners. Errors persist until the user manually closes them; success messages auto-dismiss after a timeout. Replace all existing `error : Maybe String` usage with this new system so that polling success responses no longer clear error notifications.

## Root Cause
The 2-second poll cycle (`Time.every 2000 Poll` at `Main.gren:1589`) triggers handlers like `GotTasks` that set `error = Nothing` on success (`Main.gren:382`), clearing any visible error within seconds.

## Requirements
- Create a `Notification` module with an opaque `Notification` type containing: id, message, level
- Support two notification levels: `Error` (persist until manually closed) and `Success` (auto-dismiss after ~5 seconds)
- Multiple notifications stack vertically below the header
- Each notification has a close button for manual dismissal
- Replace `error : Maybe String` in Model with `notifications : Array Notification` and `nextNotificationId : Int`
- Update all error sites in update function to add a notification instead of setting `error`
- Remove `error = Nothing` from all success handlers — notifications are independent of the poll cycle
- Add success notifications for key operations: task creation, agent save/delete, provider save/delete, settings save
- Keep `settingsValidationError : Maybe String` as-is (it is inline form validation, not a global notification)

## Acceptance Criteria
- [x] Error notifications persist until the user clicks the close button
- [x] Error notifications survive the poll cycle (not cleared by successful API responses)
- [x] Success notifications auto-dismiss after ~5 seconds but can also be manually closed
- [x] Multiple notifications stack vertically below the header
- [x] All existing error display sites use the new notification component
- [x] No regressions in settings validation error display (SystemSettings.gren)
- [x] App builds successfully (`npm run build:all`)
- [x] Tests pass (`npm run test`)

## Out of Scope
- Warning/info notification levels
- Notification animations/transitions
- Notification history or logging
- Settings validation error refactoring (inline form validation stays separate)

## Technical Context

### Files to Create
- `packages/chorus-ui/src/Notification.gren` — Notification type, view function, helpers

### Files to Modify
- `packages/chorus-ui/src/Main.gren` — Model, Msg, update, view, subscriptions
- `packages/chorus-ui/static/styles.css` — Notification styles

### Related Files (reference only)
- `packages/chorus-ui/src/View/SystemSettings.gren` — Has its own `settingsValidationError` display; leave unchanged
- `packages/chorus-ui/src/Types.gren` — Shared types (may need to import Notification)

### Patterns to Follow
- Use opaque types with smart constructors (per `agents/CODING_STANDARDS.md`)
- Use pipe operator for data transformations
- Use descriptive field names (no abbreviations or underscore suffixes)
- Fail on malformed or missing data; do not silently swallow errors

### Implementation Notes

#### Notification Module (`Notification.gren`)

```
type Notification  -- opaque
type Level = Error | Success

-- Smart constructors
error : Int -> String -> Notification
success : Int -> String -> Notification

-- Accessors
id : Notification -> Int
message : Notification -> String
level : Notification -> Level
isAutoDismiss : Notification -> Bool

-- View
viewNotifications : Array Notification -> (Int -> msg) -> Html msg
```

#### Model Changes (`Main.gren`)

Remove:
- `error : Maybe String` field

Add:
- `notifications : Array Notification`
- `nextNotificationId : Int`

#### Msg Changes (`Main.gren`)

Remove:
- `ClearError`

Add:
- `DismissNotification Int` — user clicks close button
- `AutoDismissNotification Int` — timer fires for success notifications

#### Update Changes (`Main.gren`)

All sites that currently set `error = Just msg` should instead:
1. Create a notification: `Notification.error model.nextNotificationId msg`
2. Append it to `model.notifications`
3. Increment `model.nextNotificationId`

For success notifications, also issue a delayed command:
```
Process.sleep 5000
    |> Task.perform (\_ -> AutoDismissNotification notificationId)
```

All sites that currently set `error = Nothing` on operation success should simply stop clearing — remove the `error = Nothing` line.

#### Error Sites to Convert (all in `Main.gren`)

These lines set `error = Just ...` and need conversion to `addNotification`:
- Line ~387: `GotTasks` Err
- Line ~404: `GotTask` Err
- Line ~447: `TaskCreated` Err
- Line ~485: `StatusUpdated` Err
- Line ~542: `SubmitCreateForm` validation
- Line ~612: `FileUploaded` Err
- Line ~633: `AttachmentDeleted` Err
- Line ~809: `PlanningUpdated` Err
- Line ~828: `GotAgents` Err
- Line ~862: `GotAgentSaved` Err
- Line ~878: `GotAgentDeleted` Err
- Line ~976: Agent name validation
- Line ~1033: `GotProviders` Err
- Line ~1064: `GotProviderSaved` Err
- Line ~1080: `GotProviderDeleted` Err
- Line ~1164: Provider name validation
- Line ~1220: "Select an agent before starting"
- Line ~1248: `HandoffStarted` Err
- Line ~1286: `AnswersSubmitted` Err
- Line ~1380: Workspace path validation
- Line ~1390: Directory path validation
- Line ~1572: `SettingsSaved` Err

#### Success Sites to Add Notifications

These operations currently silently succeed; add success notification:
- `TaskCreated` Ok (~line 441)
- `GotAgentSaved` Ok (~line 856)
- `GotAgentDeleted` Ok (~line 872)
- `GotProviderSaved` Ok (~line 1058)
- `GotProviderDeleted` Ok (~line 1074)
- `SettingsSaved` Ok (~line 1565)

#### View Changes (`Main.gren`)

Replace `viewError model.error` call (~line 1602) with:
```
Notification.viewNotifications model.notifications DismissNotification
```

#### CSS Changes (`styles.css`)

- Keep `.error-banner` base styles, adapt to `.notification` class
- Add `.notification--error` variant (red, existing colors)
- Add `.notification--success` variant (green)
- Add `.notification-stack` container for vertical stacking
- Each notification: flex row with message text and close button

## Testing Requirements
- Build the app: `npm run build:all`
- Run tests: `npm run test`
- Manual verification:
  - Trigger an error (e.g., stop the backend, try an operation) and confirm it persists
  - Trigger multiple errors and confirm they stack
  - Close individual notifications with the close button
  - Trigger a success operation (e.g., save an agent) and confirm the success notification appears and auto-dismisses after ~5 seconds
  - Confirm settings validation errors still display inline on the settings page

## Notes
- The `Process.sleep` approach for auto-dismiss is standard in Elm/Gren apps. It fires a message after the delay; the update handler removes the notification by id if it still exists.
- Line numbers are approximate — verify against current source before making changes.
- Helper function suggestion: create `addNotification` and `addSuccessNotification` helpers in Main.gren to avoid repeating the pattern of creating a notification, appending, incrementing id, and optionally issuing a dismiss command.
