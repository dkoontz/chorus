# Developer Report

## Task
Encode executor lifecycle invariants in the type system by refactoring ExecutorState from a flat record to a discriminated union type, removing parallel state tracking, and fixing file path inconsistencies and process management issues. This addresses 7 interrelated issues discovered during task execution.

## Files Modified
- `packages/chorus/src/Main.gren` - Refactored ExecutorState from flat record to union type (Spawning | AgentActive | ActiveHandoff), removed pendingHandoffResponses from Model, moved deferred response into SpawningExecutor/ActiveHandoff, replaced noop-provider fallback with error rejection, updated all pattern matches and helper functions throughout
- `packages/chorus/src/Provider.gren` - Removed NoProviderState variant, changed ApiProviderState session from Maybe Session to Session, added toolName field to ToolResult type alias
- `packages/chorus/src/Agent/Executor.gren` - Added toolName population from toolCallResult.toolName in both ApiSuccess and ApiError ToolResult constructions
- `packages/chorus/src/Provider/ClaudeCode.gren` - Added `exec` to shell command so bash replaces itself with the agent process, improved error messages when stderr is empty, changed catch-all branches to explicit ApiProviderState pattern matches
- `packages/chorus/src/Provider/OpenCode.gren` - Same changes as ClaudeCode: added `exec`, improved error messages, explicit ApiProviderState pattern matches
- `packages/tools/src/Tools/File.gren` - Strip search directory prefix from find output in listWithPattern so paths are relative, consistent with listDirectorySimple

## Build Status
**Status:** PASS

All three packages (chorus-ui, tools, chorus) compile successfully.

## Test Status
**Status:** PASS

87 passed, 0 failed

## Implementation Notes

### Issue 1-4: ExecutorState Union Type
- ExecutorState is now `Spawning SpawningExecutor | AgentActive ActiveExecutor | ActiveHandoff { executor : ActiveExecutor, deferredResponse : Response }`.
- Named the active variant `AgentActive` instead of `Active` to avoid collision with `TaskStatus.Active` which is imported with exposed constructors in Main.gren. Gren does not support qualified constructor names for locally defined types.
- ActiveHandoff uses a record parameter `{ executor : ActiveExecutor, deferredResponse : Response }` because Gren union type variants can only have at most 1 parameter.
- The deferred handoff response is stored on `SpawningExecutor.deferredResponse : Maybe Response` during the spawning phase, then carried into the `ActiveHandoff` variant when the provider resolves in `GotProviderResolved`.
- `pendingHandoffResponses : Dict String Response` removed from Model entirely. The response is now co-located with its executor state.
- `NoProviderState` removed. The Spawning variant has no provider fields at all.
- Tool calls arriving for a Spawning executor are rejected with an error message. The fallback tool execution path in GotToolResult was simplified to reject with an error instead of silently executing tools against a dead session.
- Added `AgentKind` union type (SystemAgent | UserAgent) to replace the `isSystemAgent : Bool` field.
- Retained `retryCount` and `sessionId` on ActiveExecutor as they are used by the planner retry logic (PlannerOutputMissing handler).

### Issue 5: ToolResult toolName
- Added `toolName : String` to the ToolResult type alias.
- Populated from `toolCallResult.toolName` in Executor.handleToolCallCompleted.
- The planner-output ToolResult in Main.gren's handleDeferredAction uses the literal `"planner-output"` as its toolName.
- Event logging now uses `toolResult.toolName` instead of `toolResult.toolCallId`.

### Issue 6: file.list Path Normalization
- The `listWithPattern` function in File.gren now strips the search directory prefix from find output paths. If `searchPath` is `/a/b/c`, the prefix `/a/b/c/` is stripped from results like `/a/b/c/file.txt` to produce `file.txt`.
- Used `String.dropFirst` and `String.unitLength` (Gren's names for these operations, not `String.dropLeft`/`String.length`).

### Issue 7: bash -c exec and Error Messages
- Added `exec` before the CLI command in both ClaudeCode and OpenCode buildShellCommand functions. The env vars are prepended before `exec`, so `bash -c "CHORUS_TASK_ID='...' exec claude ..."` causes bash to replace itself with the agent process, ensuring timeout kills reach the actual agent.
- Improved error messages: when stderr is empty, the error now says "process may have been killed by signal or timeout" instead of the uninformative "exited with code N: ".

## Iteration
1
