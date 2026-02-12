# Developer Report

## Task
Fix blocking issues from review iteration 1: path traversal vulnerability in attachment filenames and empty filename accepted in upload route. Also address non-blocking suggestions for residual CSS class name and missing attachment round-trip test.

## Files Modified
- `src/chorus/src/Web/Router.gren` - Added `isValidFilename` helper function that rejects empty filenames and filenames containing `..`, `/`, or `\`. Applied validation to all three attachment routes (upload, download, delete). Changed upload route to return `NotFound` when the `filename` query parameter is missing, instead of defaulting to empty string.
- `src/chorus/src/Main.gren` - Removed redundant empty filename check in the `UploadAttachment` handler since the router now rejects empty/missing filenames at the routing level.
- `src/chorus-ui/src/View/Dashboard.gren` - Renamed CSS class from `task-title` to `task-description` on the span wrapping the task description in `viewRecentTask`.
- `src/chorus-ui/static/styles.css` - Updated CSS selector from `.task-item-compact a:hover .task-title` to `.task-item-compact a:hover .task-description` to match the renamed class.
- `src/chorus/tests/unit/RegistryTests.gren` - Added `testAttachmentRoundTrip` test that creates a task with two attachments, encodes it to JSON, decodes it back, and verifies both attachments survive the round-trip with correct filename, size, and contentType values. Added `Attachment` to the Registry import.

## Build Status
**Status:** PASS

```
Success! Compiled 6 modules.  (chorus-ui)
Success! Compiled 4 modules.  (tools)
Success! Compiled 8 modules.  (chorus)
```

## Test Status
**Status:** PASS

```
Running 18 tests...

18 passed, 0 failed
```

## Implementation Notes

### Blocking Issue 1: Path traversal vulnerability
The `isValidFilename` function is applied at the router level for all three attachment routes. This ensures invalid filenames are rejected before reaching any handler. Filenames containing `..`, `/`, or `\` are treated as invalid and the route resolves to `NotFound`. This approach was chosen over a newtype wrapper because Gren's pattern matching in route handling would require unwrapping the newtype at every use site, adding friction without additional safety since the validation is already centralized in the router.

### Blocking Issue 2: Empty filename in upload route
The router now explicitly handles the `Nothing` case for the `filename` query parameter by returning `NotFound`, and also rejects empty filenames via the `isValidFilename` check. The redundant empty-string check in `Main.gren` was removed since it is no longer reachable.

### Suggestion: Residual CSS class name
Renamed `task-title` to `task-description` in both the Gren view and the CSS file for consistency with the title-to-description rename.

### Suggestion: Attachment round-trip test
Added a test with two attachments that verifies filename, size, and contentType survive encode/decode. This covers the non-empty attachments case that was previously untested.

### Not addressed
- Duplicate `registryErrorToString` function (Suggestion 2): This would require exposing the function from `Task.Registry` or creating a shared module, which is a structural change outside the scope of the review fixes.
- Duplicate `statusMatches`/`statusEquals` (Suggestion 3): Cross-boundary duplication between frontend and backend; not practical to consolidate.
- Upload not updating task list in model (Suggestion 4): This is a UI-only issue that resolves within 2 seconds on the next poll cycle. Fixing it would add complexity to the frontend update logic without clear user-facing benefit.
- Stale `now` in upload handler (Suggestion 6): The review noted this is not a bug and no action is required.

## Iteration
2
