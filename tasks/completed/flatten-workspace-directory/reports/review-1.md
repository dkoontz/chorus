# Code Review Report

## Summary
The implementation correctly removes the `dataDirectory` field and flattens the workspace directory layout. All acceptance criteria are met. The main concern is duplicated path-stripping logic and a variable name that violates the project's coding standards.

## Issues Found

### BLOCKING Issues

#### Issue 1: Variable name `wsRoot` violates coding standards
- **File:** `packages/chorus/src/Main.gren`
- **Line:** 1175
- **Category:** Style
- **Description:** The local variable `wsRoot` uses a 2-letter abbreviation (`ws` for "workspace"), which the project's coding standards explicitly prohibit. The standards table lists `wsRoot -> workspaceRoot` as a specific example of a bad name.
- **Suggestion:** Rename `wsRoot` to `workspaceRoot` at line 1175 and its two usages at lines 1186, 1189, and 1192.

### Suggestions

#### Suggestion 1: Duplicated path-stripping logic across 4 locations
- **File:** `packages/chorus/src/Main.gren`
- **Lines:** 278-285, 496-503, 1176-1183, 2230-2237
- **Category:** Duplication
- **Description:** The same pattern of `String.split "/" path |> Array.dropLast 1 |> String.join "/"` is repeated in 4 places. Three of these inline the logic (in `makeProvider` at line 278, the tool execution handler at line 496, and `GotConfigLoaded` at line 1176), while the fourth is the `workspaceRoot` helper function at line 2230. The `workspaceRoot` helper takes a `Model` and reads from `model.workspaceConfigPath`, which makes it unsuitable for the inline locations that either operate on a local `configPath` variable or need different fallback behavior (returning `"./conversations"` or `"./registry"` instead of calling `Debug.todo`).
- **Suggestion:** Extract a pure helper function like `parentDirectory : String -> String` that takes a file path string and returns its parent directory. Then use this helper in all 4 locations. For example:
  ```gren
  parentDirectory : String -> String
  parentDirectory path =
      path
          |> String.split "/"
          |> Array.dropLast 1
          |> String.join "/"
  ```
  Then the inline locations become `parentDirectory configPath ++ "/conversations"` and the `workspaceRoot` helper becomes:
  ```gren
  workspaceRoot model =
      when model.workspaceConfigPath is
          Just configPath ->
              parentDirectory configPath
          Nothing ->
              Debug.todo "workspaceRoot called without a loaded workspace config"
  ```

#### Suggestion 2: `conversationsDir` fallback inconsistency
- **File:** `packages/chorus/src/Main.gren`
- **Lines:** 275-288
- **Category:** Correctness
- **Description:** The `Nothing` fallback for `conversationsDir` is `"./conversations"`, while the `Nothing` fallback for `registryRoot` at line 506 is `"./registry"`. These fallback values are relative paths that would resolve against the process working directory. The other path-deriving helpers (`workspaceRoot`, `registryRootPath`, `uploadDir`) use `Debug.todo` for the `Nothing` case, arguing that these code paths are unreachable when a workspace config is loaded. Consider whether these fallbacks are genuinely reachable or whether they should also fail explicitly per the coding standards principle of "fail on malformed or missing data."
- **Suggestion:** If these code paths are truly unreachable (workspace config must be loaded before providers are created), consider using `Debug.todo` instead of silent fallbacks. If they are reachable, document why the relative path fallback is appropriate.

## Overall Assessment

**Decision:** CHANGES REQUESTED

The `wsRoot` naming issue must be addressed as it directly violates a coding standard that lists this exact variable name as an example of what not to do. The fix is a straightforward rename from `wsRoot` to `workspaceRoot` at one declaration site and its usages. The duplication suggestion is worth considering but is not blocking.
