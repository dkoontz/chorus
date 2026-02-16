# Code Review Report

## Summary

The implementation is clean and well-structured, following existing project patterns for file I/O, API endpoints, and UI components. There are two substantive issues: dead code in the backend (`GotWorkspacesLoaded` message variant) and the frontend silently discarding errors when loading workspaces, which contradicts both the acceptance criteria and the project's coding standards on error handling.

## Issues Found

### BLOCKING Issues

#### Issue 1: Dead code - `GotWorkspacesLoaded` message variant is never constructed
- **File:** `packages/chorus/src/Main.gren`
- **Line:** 163, 1729-1732
- **Category:** Simplification
- **Description:** The `GotWorkspacesLoaded` Msg variant is declared (line 163) and handled in `update` (lines 1729-1732), but it is never constructed anywhere in the codebase. The comment says "This message is not used for model updates; workspace list is read on demand," confirming it serves no purpose. Dead code adds confusion for future readers who will wonder when this message is supposed to fire.
- **Suggestion:** Remove the `GotWorkspacesLoaded` variant from the `Msg` type and its corresponding branch in `update`. If workspace loading is handled entirely via the API endpoints, there is no need for a backend-side Msg for it.

#### Issue 2: Frontend silently discards errors loading recent workspaces
- **File:** `packages/chorus-ui/src/Main.gren`
- **Line:** 1495-1498
- **Category:** Correctness
- **Description:** The `GotWorkspaces` handler discards errors with `Err _ -> { model = model, command = Cmd.none }` and a comment saying "Silently ignore errors loading recent workspaces." This violates acceptance criterion #11 ("If `workspaces.json` exists but fails to read/parse, the error is displayed to the user") and the project coding standard "Fail on Malformed or Missing Data" / "Do Not Silently Swallow Errors in Tasks." The backend correctly returns a 500 error with a descriptive message when the file exists but is unreadable or malformed, but the frontend throws this information away.
- **Suggestion:** Surface the error to the user using the existing `addErrorNotification` pattern, similar to how `WorkspaceRemoved Err` is handled at line 1524. For example: `Err err -> { model = addErrorNotification ("Failed to load recent workspaces: " ++ httpErrorToString err) model, command = Cmd.none }`.

### Suggestions

#### Suggestion 1: URL-encode the path parameter in `removeWorkspace`
- **File:** `packages/chorus-ui/src/Api.gren`
- **Line:** 568
- **Category:** Correctness
- **Description:** The `removeWorkspace` function constructs the URL as `"/api/workspaces?path=" ++ path` without URL-encoding the path. File paths containing `&`, `=`, `#`, `%`, `+`, or space characters would break the query string parser or be misinterpreted. While these characters are uncommon in file paths, they are not impossible. The same pattern exists for `uploadAttachment` (pre-existing), so this is not unique to this change.
- **Suggestion:** If Gren provides a `Url.percentEncode` or similar function, apply it to the `path` before concatenating. Alternatively, send the path in the request body instead of as a query parameter, which avoids encoding issues entirely. This is a pre-existing pattern in the codebase, so it could be addressed separately.

#### Suggestion 2: `handleListWorkspaces` performs sorting that could live closer to the data
- **File:** `packages/chorus/src/Main.gren`
- **Line:** 3736-3739
- **Category:** Simplification
- **Description:** The `handleListWorkspaces` handler sorts entries by `lastOpenedAt` descending (`Array.sortBy .lastOpenedAt |> Array.reverse`). This sorting logic is inlined in the API handler. If other code paths ever need sorted workspace entries, the sorting would need to be duplicated.
- **Suggestion:** Consider moving the sort into `loadWorkspaceEntries` so that entries are always returned in most-recent-first order. Alternatively, create a dedicated `loadSortedWorkspaceEntries` helper. This is minor since there is currently only one consumer.

## Overall Assessment

**Decision:** CHANGES REQUESTED

The two blocking issues should be addressed:

1. Remove the unused `GotWorkspacesLoaded` message variant and its handler to eliminate dead code.
2. Surface errors from `GotWorkspaces` to the user via `addErrorNotification` to satisfy acceptance criterion #11 and align with the project's coding standards on error handling.
