# Avoid Abbreviated Field and Variable Names

## Summary
Add a coding standard requiring field and variable names to avoid 2-letter abbreviations in favor of full descriptive names, then rename all existing abbreviated names across the codebase to comply.

## Requirements
- Add a new section to `agents/CODING_STANDARDS.md` documenting the naming standard: field and variable names should not abbreviate to 2 letters; prefer full descriptive names instead
- Rename `fsPermission` to `filesystemPermission` everywhere (232 occurrences across 16 files)
- Rename `cpPermission` to `childProcessPermission` everywhere (91 occurrences across 13 files)
- Rename `wsRoot` to `workspaceRoot` (8 occurrences in 1 file)
- Rename `tid` to `taskId` (95 occurrences across 12 files)
- Rename `fname` to `filename` (3 occurrences in 1 file)
- All renames apply to both record field definitions and local variable/parameter names
- The project must build and tests must pass after all renames

## Acceptance Criteria
- [ ] `agents/CODING_STANDARDS.md` has a new section about avoiding 2-letter abbreviated names, with examples showing `fsPermission`/`cpPermission` as bad and `filesystemPermission`/`childProcessPermission` as good
- [ ] Zero occurrences of `fsPermission` remain in `.gren` files (replaced with `filesystemPermission`)
- [ ] Zero occurrences of `cpPermission` remain in `.gren` files (replaced with `childProcessPermission`)
- [ ] Zero occurrences of `wsRoot` remain in `.gren` files (replaced with `workspaceRoot`)
- [ ] Zero occurrences of `tid` as a variable or field name remain in `.gren` files (replaced with `taskId`)
- [ ] Zero occurrences of `fname` remain in `.gren` files (replaced with `filename`)
- [ ] `npm run build:all` succeeds
- [ ] `npm run test` passes

## Out of Scope
- Renaming names that are already full words (e.g., `env`, `msg`, `cmd`)
- Renaming names required by external library APIs (e.g., `port_` in library-consumed records)
- Renaming 3+ letter abbreviations — this task targets 2-letter prefix abbreviations and short contractions only
- Changing the `eventType` field (this is a full word, not an abbreviation)

## Technical Context

### Rename inventory

| Current | Replacement | Occurrences | Files |
|---|---|---|---|
| `fsPermission` | `filesystemPermission` | 232 | 16 |
| `cpPermission` | `childProcessPermission` | 91 | 13 |
| `wsRoot` | `workspaceRoot` | 8 | 1 |
| `tid` | `taskId` | 95 | 12 |
| `fname` | `filename` | 3 | 1 |

### Files to Modify

**Coding standards:**
- `agents/CODING_STANDARDS.md` — Add new naming standard section

**Core chorus package (`packages/chorus/src/`):**
- `Main.gren` — Rename `fsPermission` (16), `cpPermission` (8)
- `Task/Registry.gren` — Rename `fsPermission` (33), `tid` (6)
- `Task/Queue.gren` — Rename `fsPermission` (17)
- `Agent/Registry.gren` — Rename `fsPermission` (21)
- `Agent/Executor.gren` — Rename `fsPermission` (4), `cpPermission` (2)
- `Web/Api.gren` — Rename `fsPermission` (8), `tid` (2)
- `Web/ToolExecution.gren` — Rename `fsPermission` (7), `cpPermission` (3), `wsRoot` (8)
- `Web/Static.gren` — Rename `fsPermission` (3)
- `Web/Router.gren` — Rename `tid` (31), `fname` (3)
- `Provider/OpenCode.gren` — Rename `fsPermission` (2), `tid` (2)
- `Provider/OpenAiCompat.gren` — Rename `fsPermission` (3)
- `Provider/ClaudeCode.gren` — Rename `tid` (2)

**Shared package (`packages/shared/`):**
- `Id.gren` — Rename `tid` (2)

**UI package (`packages/chorus-ui/src/`):**
- `Api.gren` — Rename `tid` (18)
- `View/TaskDetail.gren` — Rename `tid` (16)
- `Main.gren` — Rename `tid` (1)

**Tools package (`packages/tools/src/`):**
- `FileToolsMain.gren` — Rename `fsPermission` (11), `cpPermission` (7)
- `CombinedMain.gren` — Rename `fsPermission` (11), `cpPermission` (8)
- `TaskToolsMain.gren` — Rename `cpPermission` (7)
- `HandoffMain.gren` — Rename `cpPermission` (6)
- `ChorusToolsMain.gren` — Rename `cpPermission` (11)
- `Tools/File.gren` — Rename `fsPermission` (22), `cpPermission` (11)
- `Tools/Handoff.gren` — Rename `cpPermission` (10)
- `Tools/TaskStatus.gren` — Rename `cpPermission` (4)

**Integration runner (`packages/integration-runner/src/`):**
- `Runner.gren` — Rename `fsPermission` (18), `cpPermission` (4)
- `Main.gren` — Rename `fsPermission` (20), `cpPermission` (10)

**Tests:**
- `packages/chorus/tests/integration/IntegrationRunner.gren` — Rename `fsPermission` (36), `tid` (12)
- `packages/chorus/tests/unit/RegistryTests.gren` — Rename `tid` (2)

### Related Files (reference only)
- `packages/chorus/src/Provider/ClaudeCode.gren` — Already uses `childProcessPermission` as a field name in its config type; this is the target convention
- `packages/chorus/src/Provider/OpenCode.gren` — Already uses `childProcessPermission` as a field name in its config type; this is the target convention

### Patterns to Follow
- The existing `childProcessPermission` field name in `ClaudeCode.gren` and `OpenCode.gren` provider configs is the pattern to match — this task makes all other files consistent with it
- Use simple find-and-replace within each file; the renames are mechanical
- For `tid` rename: be careful in `Web/Router.gren` where `tid` appears in record pattern matching — the field name and binding name are the same (e.g., `{ tid = Just tid }` becomes `{ taskId = Just taskId }`)
- For `fname` rename: the variable `fname` becomes `filename`, which matches the record field it is extracted from

### Potential conflicts for `tid` rename
- In `Web/Router.gren`, `tid` is used both as a record field key in pattern matching and as a local binding. When renaming, the pattern `{ tid = Just tid, filename = Just fname }` becomes `{ taskId = Just taskId, filename = Just filename }`. This is a destructuring pattern, not a record type definition, so the field name in the pattern must match whatever the record being destructured uses. Check that `Id.taskIdFromString` result is being bound in a let-expression or inline record, not a named type.
- In `chorus-ui/src/Api.gren`, `tid` is a function parameter of type `String` — rename to `taskId`
- In `chorus-ui/src/View/TaskDetail.gren`, `tid` is a local let-binding — rename to `taskId`

## Testing Requirements
- Run `npm run build:all` — must succeed with zero compiler errors
- Run `npm run test` — all tests must pass
- Grep the codebase for each old name to confirm zero remaining occurrences:
  - `rg '\bfsPermission\b' packages/ --type gren` should return nothing
  - `rg '\bcpPermission\b' packages/ --type gren` should return nothing
  - `rg '\bwsRoot\b' packages/ --type gren` should return nothing
  - `rg '\bfname\b' packages/ --type gren` should return nothing
  - For `tid`: verify no `.gren` files use `tid` as a variable name (note: `tid` may appear inside string literals like `"TaskNotFound: " ++ Id.taskIdToString tid` — those occurrences should also be renamed since `tid` there is the variable)

## Notes
- This is a large mechanical rename (429 total occurrences across 29 files). The renames are straightforward find-and-replace operations within each file, but care is needed to avoid partial matches (e.g., do not replace `tid` inside words like `width` or `entity`)
- The `childProcessPermission` name already exists in 2 provider config types, so this rename brings the rest of the codebase into alignment
- No `filesystemPermission` usage exists yet — this will be a new name everywhere
- The CODING_STANDARDS.md section should use `fsPermission`/`cpPermission` as the primary "bad" examples since they are the most common violations and directly motivated this standard
