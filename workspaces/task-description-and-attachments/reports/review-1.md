# Code Review Report

## Summary

The implementation covers the `title` to `description` rename and file attachment support across backend, frontend, tests, and Docker configuration. The code is well-structured and follows existing patterns. There are two blocking issues related to security and correctness, plus several suggestions for improvement.

## Issues Found

### BLOCKING Issues

#### Issue 1: Path traversal vulnerability in attachment filenames
- **File:** `src/chorus/src/Web/Api.gren`
- **Line:** 333-398 (requestUploadAttachment), 410-457 (requestDownloadAttachment), 462-515 (requestDeleteAttachment)
- **Category:** Correctness
- **Description:** The filename parameter from the query string or URL path is used directly to construct file paths without any sanitization. An attacker could supply a filename like `../../etc/passwd` or `../../../sensitive-file` to read, write, or delete files outside the intended upload directory. This is noted in the project's coding standards under "Use Newtypes for Structured Data" which specifically calls out `FilePath` as a case where validation is needed to prevent path traversal.
- **Suggestion:** Validate the filename before use. At minimum, reject filenames that contain `..`, `/`, or `\`. A more robust approach following the coding standards would be to create a `SafeFilename` newtype that only allows simple filenames (no path separators, no `..`). Apply this validation in the router when parsing the filename from the URL, or at the start of each attachment handler. For example:
  ```gren
  isValidFilename : String -> Bool
  isValidFilename name =
      not (String.isEmpty name)
          && not (String.contains ".." name)
          && not (String.contains "/" name)
          && not (String.contains "\\" name)
  ```

#### Issue 2: Empty filename accepted in upload route parsing
- **File:** `src/chorus/src/Web/Router.gren`
- **Line:** 83-87
- **Category:** Correctness
- **Description:** When the `filename` query parameter is missing from `POST /api/tasks/:id/attachments`, the router sets `filename` to an empty string via `Maybe.withDefault ""`. This means the route matches successfully but with an invalid filename. The empty filename check is deferred to `Main.gren` (line 388-389), but the route itself has already been parsed as `UploadAttachment` with an empty filename. If a consumer of the router relies on the route matching to mean valid input, this could cause issues. More critically, if the empty-string check in `Main.gren` were ever removed or bypassed, the upload handler would write a file with no name.
- **Suggestion:** Return `NotFound` from the router when the `filename` query parameter is missing, rather than accepting an empty filename. Alternatively, change the route variant to `UploadAttachment { taskId : String, filename : Maybe String }` so the absence is explicit. The simplest fix:
  ```gren
  { method = POST, segments = [ "api", "tasks", taskId, "attachments" ] } ->
      when Dict.get "filename" queryParams is
          Just filename ->
              if String.isEmpty filename then
                  NotFound
              else
                  UploadAttachment { taskId = taskId, filename = filename }
          Nothing ->
              NotFound
  ```

### Suggestions

#### Suggestion 1: Residual CSS class name `task-title` in Dashboard
- **File:** `src/chorus-ui/src/View/Dashboard.gren`
- **Line:** 69
- **Category:** Naming
- **Description:** The `span` wrapping the task description in `viewRecentTask` uses the CSS class `task-title` alongside the new `task-description-truncate`. The rename from `title` to `description` was applied to the data field but the old CSS class name `task-title` was left behind, which is inconsistent with the rename.
- **Suggestion:** Rename the CSS class from `task-title` to `task-description` for consistency, and update the corresponding CSS rule in `styles.css` (line 286 `.task-item-compact a:hover .task-title`).

#### Suggestion 2: Duplicate `registryErrorToString` function
- **File:** `src/chorus/src/Main.gren` (line 553) and `src/chorus/src/Web/Api.gren` (line 635)
- **Line:** Both files
- **Category:** Duplication
- **Description:** The `registryErrorToString` function is implemented identically in both `Main.gren` and `Web.Api.gren`. Both convert `Registry.Error` variants to strings using the same pattern and wording.
- **Suggestion:** Move the function to `Task.Registry` and expose it, or create a shared helper module, then import it in both `Main.gren` and `Web.Api.gren`. The function is also duplicated again in `IntegrationRunner.gren`, though test helpers are more acceptable to duplicate.

#### Suggestion 3: Duplicate `statusMatches` / `statusEquals` functions
- **File:** `src/chorus-ui/src/View/Dashboard.gren` (line 102) and `src/chorus/src/Task/Registry.gren` (line 904)
- **Line:** Both files
- **Category:** Duplication
- **Description:** The `statusMatches` function in `Dashboard.gren` and `statusEquals` in `Registry.gren` implement the same logic with the same pattern matching structure, just with different names.
- **Suggestion:** This is a cross-boundary duplication (backend vs frontend) so consolidation is not straightforward. However, consider exposing a `statusEquals` function from the frontend `Api` module to avoid having it re-implemented in view modules.

#### Suggestion 4: Upload does not update task list in model
- **File:** `src/chorus-ui/src/Main.gren`
- **Line:** 438-452 (FileUploaded handler)
- **Category:** Correctness
- **Description:** When a file is uploaded successfully, `FileUploaded` updates `selectedTask` but does not update the task in the `tasks` array. If the user navigates back to the task list, the stale task (without the new attachment count or updated timestamp) will be shown until the next poll cycle (2 seconds). The same applies to `AttachmentDeleted`.
- **Suggestion:** Update the `tasks` array in addition to `selectedTask`, similar to how `StatusUpdated` handles it. This keeps the model consistent.

#### Suggestion 5: Missing unit test for attachment encode/decode round-trip
- **File:** `src/chorus/tests/unit/RegistryTests.gren`
- **Line:** End of file
- **Category:** Correctness
- **Description:** The task specification requires verifying that task JSON with an `attachments` field encodes and decodes correctly, and that task JSON without an `attachments` field decodes with an empty array. The existing tests all use `attachments = []`, so the backward compatibility path is tested implicitly but the non-empty attachments case is not tested.
- **Suggestion:** Add a test that creates a task with one or more attachments in the `attachments` array, encodes it, decodes it, and verifies the attachments survive the round-trip.

#### Suggestion 6: `wrapResponse` called with stale `now` in upload handler
- **File:** `src/chorus/src/Web/Api.gren`
- **Line:** 370-392
- **Category:** Simplification
- **Description:** In `requestUploadAttachment`, the `now` value obtained for the attachment's `uploadedAt` timestamp is also passed to `wrapResponse` for the response metadata. However, `Registry.updateTask` internally calls `Time.now` again to set `updatedAt`, meaning the response metadata timestamp could differ from the task's `updatedAt`. This is not a bug per se, but it means the metadata timestamp and the task's `updatedAt` can diverge slightly.
- **Suggestion:** This is a minor inconsistency that is unlikely to cause problems in practice. No action required, but worth being aware of.

## Overall Assessment

**Decision:** CHANGES REQUESTED

The path traversal vulnerability in attachment filename handling (Issue 1) must be fixed before merge. An attacker-controlled filename could be used to read, write, or delete arbitrary files on the server's filesystem. The empty filename issue (Issue 2) should also be addressed to prevent invalid state from propagating through the router.

The suggestions are worth considering but are not required for this change. The residual `task-title` CSS class (Suggestion 1) and the missing attachment round-trip test (Suggestion 5) are the most worthwhile to address in this iteration.
