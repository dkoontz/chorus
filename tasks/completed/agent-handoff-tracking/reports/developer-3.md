# Developer Report

## Task
Fix the backward-compatibility blocker identified in QA iteration 2: decoders crash on pre-existing task data that lacks the `currentAgent` and `agentChain` fields. Also address 4 test quality issues.

## Files Modified
- `packages/shared/Types.gren` - Wrapped `currentAgent` and `agentChain` field decoders in `Decode.oneOf` with fallbacks in both `descriptionOnlyTaskDecoder` and `plannedTaskDecoder`
- `packages/chorus/src/Task/Registry.gren` - Wrapped `currentAgent` field decoder in `Decode.oneOf` with fallback in `taskSummaryDecoder`
- `packages/chorus/tests/unit/RegistryTests.gren` - Improved `testTaskAgentChainAccessor` to verify content (not just count); added 3 new tests: `testHandoffRecordWithNothingCompletedAtEncodeDecode`, `testPlannedTaskWithHandoffFieldsEncodeDecode`, `testSetAgentChainMutator`

## Build Status
**Status:** PASS

Build succeeded: "Success! Compiled 13 modules."

## Test Status
**Status:** PASS

32 unit tests passed, 0 failed (up from 29 -- 3 new tests added).
19 integration tests passed, 0 failed.

## Implementation Notes

### Blocker fix: Backward-compatible decoders
Three decoders were updated to handle missing `currentAgent` and `agentChain` fields using `Decode.oneOf` with fallbacks:

1. `taskSummaryDecoder` in `Task/Registry.gren` -- `currentAgent` falls back to `Nothing`
2. `descriptionOnlyTaskDecoder` in `Types.gren` -- `currentAgent` falls back to `Nothing`, `agentChain` falls back to `[]`
3. `plannedTaskDecoder` in `Types.gren` -- `currentAgent` falls back to `Nothing`, `agentChain` falls back to `[]`

The `attachments` decoder was intentionally left without a `Decode.oneOf` fallback because the `attachments` field predates this feature and exists in all data files. Adding a fallback there would have silently swallowed malformed attachment data, which the existing `testMalformedAttachmentMissingField` and `testMalformedAttachmentWrongType` tests correctly verify as decode failures.

The fallbacks for `currentAgent` and `agentChain` are semantically accurate: a task created before handoff tracking has no current agent and no handoff history. These are not invented defaults hiding missing data -- they correctly represent the state of tasks that predate the feature.

### Test quality improvements (from QA Issue list)
1. **Issue 1** - `testTaskAgentChainAccessor` now verifies `agentName`, `startedAt`, `completedAt`, and `output` for both chain entries
2. **Issue 2** - Added `testHandoffRecordWithNothingCompletedAtEncodeDecode` to verify `completedAt = Nothing` round-trips correctly
3. **Issue 3** - Added `testSetAgentChainMutator` verifying the mutator works on both `DescriptionOnly` and `Planned` task variants
4. **Issue 4** - Added `testPlannedTaskWithHandoffFieldsEncodeDecode` to test the planned task decoder path with populated handoff fields

## Iteration
3
