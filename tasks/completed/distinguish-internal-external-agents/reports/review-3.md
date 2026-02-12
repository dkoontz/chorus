# Code Review Report

## Summary

The iteration 3 changes address the QA-reported blocker (old-format agent data migration) and add comprehensive unit tests for AgentConfig. The migration logic is sound and the tests are well-structured. However, the developer introduced naming regressions that violate the project's coding standards.

## Issues Found

### BLOCKING Issues

#### Issue 1: `filesystemPermission` renamed to `fsPermission` violates coding standard
- **File:** `packages/chorus/src/Agent/Registry.gren`
- **Line:** 37, and all function parameter names throughout the file (lines 60, 78, 88, etc.)
- **Category:** Style
- **Description:** The developer renamed the `AgentRegistry` record field from `filesystemPermission` to `fsPermission`, and correspondingly renamed all function parameters from `filesystemPermission` to `fsPermission`. The project's coding standard "Avoid Abbreviated Field and Variable Names" explicitly lists `fsPermission` as a BAD example and `filesystemPermission` as the GOOD example. This rename goes in the opposite direction of the standard.
- **Suggestion:** Revert the field name back to `filesystemPermission` and restore all parameter names to `filesystemPermission` throughout the file.

#### Issue 2: `taskId` renamed to `tid` in test helper violates coding standard
- **File:** `packages/chorus/tests/unit/RegistryTests.gren`
- **Line:** 60-61
- **Category:** Style
- **Description:** The `testTaskId` helper function's local variable was renamed from `taskId` to `tid`. The coding standard explicitly lists `tid` as a BAD example (contraction of "task id") and `taskId` as the GOOD example.
- **Suggestion:** Revert lines 60-61 back to `Just taskId -> taskId`.

### Suggestions

#### Suggestion 1: Module doc comment says "six" agents but there are now seven
- **File:** `packages/chorus/src/Agent/Registry.gren`
- **Line:** 14-16
- **Category:** Correctness
- **Description:** The module doc comment states "default configs are seeded for the six known agents: researcher, planner, writer-workflow, writer, editor, fact-checker" but `task-validator` is now also seeded as a seventh agent. The agent list in the comment also omits `task-validator`.
- **Suggestion:** Update the comment to "seven known agents" and include `task-validator` in the list.

#### Suggestion 2: `seedDefaults` doc comment says "six" agents
- **File:** `packages/chorus/src/Agent/Registry.gren`
- **Line:** 151
- **Category:** Correctness
- **Description:** The doc comment reads "Write default configs for the six known agents" but the function now writes seven configs.
- **Suggestion:** Update to "Write default configs for the seven known agents" or, better, remove the count entirely and say "Write default configs for all known agents" to avoid future staleness.

#### Suggestion 3: `validateExistingFiles` catches all errors including filesystem errors
- **File:** `packages/chorus/src/Agent/Registry.gren`
- **Line:** 119
- **Category:** Correctness
- **Description:** The `onError` on line 119 catches all error types from `readAgentConfigFile`, including `FileSystemError` (e.g., permission denied, disk I/O failure). A filesystem error would be misinterpreted as "file has invalid format" and trigger a delete-and-re-seed cycle, when the correct response would be to propagate the error. In practice this is unlikely to cause problems since a filesystem error would also likely prevent the re-seed from succeeding, but the logic is imprecise.
- **Suggestion:** Consider matching on the error type: only treat `JsonDecodeError` as an invalid-format signal and propagate `FileSystemError` and `AgentNotFound` as real failures.

## Overall Assessment

**Decision:** CHANGES REQUESTED

The two naming regressions (`filesystemPermission` -> `fsPermission` and `taskId` -> `tid`) must be reverted. Both violate explicitly documented coding standards with the exact identifiers used here listed as bad examples in the standards document. The suggestions about doc comment accuracy and error handling precision are worth addressing but are not blocking.
