# Add Workspace Name to Creation Flow with Default Path

## Summary

Update the workspace creation experience so users can name their workspace and get a sensible default file path. Instead of entering a full directory path, users type a workspace name, see a computed path (e.g., `~/Documents/ChorusWorkspaces/my-project`), and click Create. The path field remains visible and editable for users who want a custom location.

## Requirements

- Add a `GET /api/config/defaults` backend endpoint that returns the OS-appropriate default workspace base path (`<home>/Documents/ChorusWorkspaces`) using `FileSystem.homeDirectory`.
- Add the corresponding `GetConfigDefaults` route to the Router.
- Add a `getConfigDefaults` function to the UI's `Api` module to call the new endpoint.
- Redesign the "New Workspace" section in the Workspaces view:
  - Name input field (primary, top field)
  - Path input field below it, auto-computed as `<defaultBasePath>/<name>` when the name changes
  - Path field is always visible and directly editable (editing it decouples it from the name)
  - "Create" button sends the final path value (whether auto-computed or manually overridden) to the existing `POST /api/config/create` endpoint
- Fetch the default workspace base path when the Workspaces page loads (or on app init) so the path preview works immediately.
- Validate workspace names: reject names containing `/`, `\`, or `..`. Allow most other characters including spaces.

## Acceptance Criteria

- [ ] `GET /api/config/defaults` returns JSON `{ "data": { "defaultWorkspacePath": "<home>/Documents/ChorusWorkspaces" } }` where `<home>` is the actual OS home directory
- [ ] The Router correctly parses `GET /api/config/defaults` to the `GetConfigDefaults` route
- [ ] The Workspaces page shows a "Name" input field above the existing path field in the "New Workspace" section
- [ ] Typing a name auto-populates the path field with `<defaultBasePath>/<name>`
- [ ] Manually editing the path field decouples it from the name (further name edits no longer overwrite a manually-edited path)
- [ ] Clearing the name field clears the auto-computed path (but only if path was not manually edited)
- [ ] The "Create" button sends the path value to `POST /api/config/create` (unchanged API)
- [ ] The "Create" button is disabled when the path field is empty
- [ ] Names containing `/`, `\`, or `..` show a validation error and the path is not auto-computed
- [ ] The app builds successfully with `npm run build:all`
- [ ] Existing tests pass with `npm run test`
- [ ] New router test covers `GET /api/config/defaults` parsing

## Out of Scope

- Adding a `name` field to `WorkspaceEntry` (recent workspaces list) -- names can be inferred from paths if needed later
- Changing the `POST /api/config/create` API contract -- it continues to accept `{ "path": "..." }`
- Windows-specific path handling -- the server runs on POSIX systems
- Workspace name uniqueness validation -- the filesystem will reject duplicate paths naturally

## Technical Context

### Files to Modify

- `packages/chorus/src/Web/Router.gren` -- Add `GetConfigDefaults` route variant and parse rule for `GET /api/config/defaults`
- `packages/chorus/src/Main.gren` -- Add `handleGetConfigDefaults` handler that uses `FileSystem.homeDirectory` to build the default path; wire it into the request dispatcher alongside the other config routes (before the registry check at line ~1760)
- `packages/chorus/tests/unit/RouterTests.gren` -- Add test for `GET /api/config/defaults` route parsing
- `packages/chorus-ui/src/Api.gren` -- Add `getConfigDefaults` function that calls `GET /api/config/defaults` and decodes the response
- `packages/chorus-ui/src/Main.gren` -- Add model fields (`createName : String`, `defaultWorkspacePath : String`, `createPathManuallyEdited : Bool`), new `Msg` variants (`GotConfigDefaults`, `UpdateCreateName`), update logic to auto-compute path from name, fetch defaults on init/page load
- `packages/chorus-ui/src/View/Workspaces.gren` -- Add name input field, update `Config msg` type alias with new fields/callbacks, add name validation display

### Related Files (reference only)

- `packages/shared/Types.gren` -- Contains `WorkspaceConfig` and `WorkspaceEntry` types (no changes needed)
- `packages/chorus/src/Config.gren` -- App-level config (no changes needed; the default workspace path is computed at request time, not stored in config)
- `/Users/david/dev/gren-lang/node/src/FileSystem.gren` -- Provides `homeDirectory : Permission -> Task x Path` used to get the OS home directory

### Patterns to Follow

- **Router pattern**: Follow the existing route definition style. Add `GetConfigDefaults` to the `Route` type, add the parse rule `{ method = GET, segments = [ "api", "config", "defaults" ] } -> GetConfigDefaults`, and add the `routeToString` case. Place it near the other config routes (`GetConfig`, `UpdateConfig`, `SelectConfig`, `CreateConfig`).
- **Handler pattern**: The handler goes in the config routes section of the request dispatcher (lines ~1760-1777 in Main.gren) which runs before the registry check, since this endpoint does not require a loaded workspace. The handler should use `FileSystem.homeDirectory model.filesystemPermission` to get the home path, then construct `<home>/Documents/ChorusWorkspaces` and return it as JSON.
- **API response format**: Use the standard `{ "data": { ... } }` wrapper that all API responses use. The UI's `Api.dataDecoder` helper can unwrap it.
- **UI API function pattern**: Follow the pattern of `getConfig` -- a simple GET request with `expectApiResponse` and a decoder. The decoder extracts `defaultWorkspacePath` from the `data` wrapper.
- **UI model update pattern**: Follow the existing `UpdateOpenPath`/`UpdateCreatePath` pattern for the new `UpdateCreateName` message. The auto-compute logic goes in the `UpdateCreateName` handler: if `createPathManuallyEdited` is `False`, set `createPath` to `defaultWorkspacePath ++ "/" ++ name`.
- **UI view pattern**: The `Workspaces.Config msg` type alias gets new fields (`createName`, `defaultWorkspacePath`, `createPathManuallyEdited`, `onUpdateCreateName`, `nameValidationError`). The `viewCreateWorkspace` function adds the name input above the existing path input.
- **Coding standards**: Use descriptive field names (not abbreviated). Do not silently swallow errors from `FileSystem.homeDirectory` -- propagate them. Use `|>` pipe operator for transformations.
- **Name validation**: Perform client-side in the `UpdateCreateName` handler. Check for `/`, `\`, and `..` in the name string. If invalid, set a validation error string in the model and do not update the path. The view displays the error below the name input.

## Testing Requirements

- Add a router test: `GET /api/config/defaults` parses to `GetConfigDefaults`
- Manual testing: verify the full flow -- open Workspaces page, type a name, see path auto-populate, create workspace, verify it appears in recent workspaces
- Manual testing: verify path override -- type a name, manually edit the path, verify name changes no longer overwrite the path
- Manual testing: verify name validation -- type a name with `/` or `..`, verify error message appears
- Build verification: `npm run build:all` succeeds
- Test verification: `npm run test` passes

## Notes

- The `FileSystem.homeDirectory` function returns a `Task x Path`. Since the handler needs to execute this task and respond with JSON, it should use `GrenTask.perform` with a new message variant (e.g., `GotConfigDefaults`) or do it inline. The simplest approach is to perform the task and send the response in the callback, similar to how `handleListWorkspaces` works.
- The `createPathManuallyEdited` flag tracks whether the user has directly edited the path field. It resets to `False` when the name field is cleared entirely (empty string). This allows the user to "reset" by clearing the name and retyping.
- The default base path `<home>/Documents/ChorusWorkspaces` uses the POSIX path separator since the server runs on macOS/Linux. `Path.toPosixString` converts the `Path` from `FileSystem.homeDirectory`.
- The existing `POST /api/config/create` endpoint is unchanged -- it continues to accept `{ "path": "..." }`. The frontend is responsible for constructing the full path from name + default base path.
