# Queued Messages Edit/Delete UI

## Summary

Add edit and delete functionality to the queued messages list in the task detail view. Messages can be edited inline with click-to-edit, and deleted with a single click. When editing the next message in the queue, processing pauses until editing is complete.

## Requirements

- Click on a queued message to enter edit mode (text converts to input field)
- Press Enter to save the edited message
- Press Escape to cancel editing
- Delete icon appears next to each message in the queue
- Delete immediately removes the message (no confirmation dialog)
- When editing the first message in the queue (the "next" message), the queue pauses processing
- Pausing only affects the specific task's session, not the whole system
- Edit lock is released when editing is saved or cancelled

## Acceptance Criteria

- [ ] Clicking on a queued message text converts it to an editable input field
- [ ] Pressing Enter saves the updated message content via API
- [ ] Pressing Escape cancels editing and reverts to display mode
- [ ] Each queued message displays a delete icon
- [ ] Clicking the delete icon removes the message from the queue via API
- [ ] Queue refreshes after successful edit or delete
- [ ] When editing the first message in the queue, an "editing" lock is acquired
- [ ] Queue processing respects the editing lock (does not dequeue while locked)
- [ ] Lock is released when edit is saved or cancelled
- [ ] Edit/delete operations show appropriate error messages on failure

## Out of Scope

- Confirmation dialogs for delete
- Drag-and-drop reordering of messages
- Editing messages that are not in the queue (e.g., already processed)
- Bulk edit/delete operations

## Technical Context

### Files to Modify

- `src/chorus-ui/src/View/TaskDetail.gren` - Add click-to-edit and delete UI to `viewQueuedMessage`, add editing state tracking
- `src/chorus-ui/src/Main.gren` - Add messages for edit/delete operations, track editing state in Model
- `src/chorus-ui/src/Api.gren` - Add `updateQueuedMessage` and `deleteQueuedMessage` API functions
- `src/chorus-ui/static/styles.css` - Add styles for editable queue items and delete icons
- `src/chorus/src/Web/Router.gren` - Add routes for PUT and DELETE on `/api/tasks/:id/queue/:messageId`
- `src/chorus/src/Web/Api.gren` - Add `requestUpdateMessage` and `requestDeleteMessage` handlers
- `src/chorus/src/Task/Queue.gren` - Add `updateMessage`, `deleteMessage`, and editing lock functions

### Related Files (reference only)

- `src/chorus-ui/src/View/TaskList.gren` - Reference for existing UI patterns
- `src/chorus/src/Web/Server.gren` - Reference for request handling patterns
- `src/chorus/tests/unit/QueueTests.gren` - Existing queue tests to extend

### Patterns to Follow

- Gren uses `when ... is` syntax for case matching (not `case ... of`)
- Record updates use `{ model | field = value }` syntax
- HTML events use `Html.Events` module (onClick, onInput, etc.)
- API functions follow pattern: `requestXxx : ApiContext -> ... -> (ApiResult -> msg) -> Cmd msg`
- Routes are defined as union types in `Web.Router`
- HTTP method matching uses `HttpServer.Method` (GET, PUT, POST, DELETE)
- Task operations return `GrenTask.Task Error Result`

## Implementation Notes

### Frontend State

Add to `Model` in `Main.gren`:
```gren
editingMessageId : Maybe String  -- ID of message currently being edited
editingContent : String          -- Content in the edit field
```

Add messages:
```gren
type Msg
    = ...
    | StartEditMessage String String  -- messageId, currentContent
    | UpdateEditContent String
    | SaveEditMessage String           -- taskId
    | CancelEditMessage
    | DeleteMessage String String      -- taskId, messageId
    | MessageUpdated (Result Http.Error Api.QueuedMessage)
    | MessageDeleted (Result Http.Error {})
```

### Backend API

New routes in `Router.gren`:
```gren
| UpdateQueueMessage String String  -- PUT /api/tasks/:taskId/queue/:messageId
| DeleteQueueMessage String String  -- DELETE /api/tasks/:taskId/queue/:messageId
| AcquireEditLock String String     -- PUT /api/tasks/:taskId/queue/:messageId/lock
| ReleaseEditLock String String     -- DELETE /api/tasks/:taskId/queue/:messageId/lock
```

### Queue Lock Mechanism

The editing lock should be stored in the queue.json file:
```json
{
  "messages": [...],
  "editingLock": {
    "messageId": "msg-123",
    "acquiredAt": 1707048600000
  }
}
```

The `dequeue` function should check for an editing lock on the first message before removing it. If locked, return Nothing (queue appears empty to processor).

### CSS Additions

```css
.queue-item-editable { cursor: pointer; }
.queue-item-editing { background: var(--color-surface); border: 2px solid var(--color-primary); }
.queue-item-edit-input { width: 100%; padding: 8px; font-size: 13px; border: none; }
.queue-item-delete { cursor: pointer; color: var(--color-danger); margin-left: 8px; }
.queue-item-delete:hover { color: #dc2626; }
```

## Testing Requirements

- Unit test: `updateMessage` correctly modifies message content
- Unit test: `deleteMessage` removes message from queue
- Unit test: `dequeue` returns Nothing when first message is locked
- Unit test: Lock is not respected for non-first messages
- Integration test: Edit flow via API (acquire lock, update, release lock)
- Manual test: Click message, edit, press Enter, verify saved
- Manual test: Click delete, verify message removed
- Manual test: Edit first message, verify queue processing pauses

## Notes

- The lock mechanism only affects dequeue operations, not direct reads of the queue
- Lock should have a timeout (e.g., 5 minutes) to prevent stuck queues if UI crashes
- The lock acquisition should happen when editing starts, not when the user clicks the input
- Consider optimistic UI updates for better responsiveness
