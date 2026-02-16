# Developer Report

## Task
Fix planner-output tool invocation by adding chorus-tools CLI format to task-validator instructions, and add session resume retry when the planner exits without calling the planner-output tool.

## Files Modified
- `packages/chorus/src/Agent/Registry.gren` - Updated `taskValidatorInstructions` to replace raw JSON examples with `chorus-tools` Bash invocations matching the format from `ToolContext.gren`, and added a guideline that tools are invoked via chorus-tools CLI through Bash
- `packages/chorus/src/Provider.gren` - Changed `AgentCompleted String` to `AgentCompleted { output : String, sessionId : Maybe String }`; added `resumeSessionId : Maybe String` to `StartConfig`
- `packages/chorus/src/Provider/ClaudeCode.gren` - Use `startConfig.resumeSessionId` instead of hardcoded `Nothing`; skip system prompt when resuming; extract `session_id` from JSON output; emit new `AgentCompleted` record
- `packages/chorus/src/Provider/OpenCode.gren` - Use `startConfig.resumeSessionId` for `cliArgs.sessionId`; skip AGENTS.md write on resume; extract `session_id` from JSON output; emit new `AgentCompleted` record
- `packages/chorus/src/Main.gren` - Updated `outputToolInstruction` to include chorus-tools invocation hint; added `resumeSessionId = Nothing` to `spawnAgent`'s `StartConfig`; extract and store `sessionId` on executor in `handleProviderEvent`; replaced immediate failure in `handlePlannerComplete`'s `PlannerOutputMissing` branch with retry logic (resume session with reminder, limit 1 retry)

## Build Status
**Status:** PASS

## Test Status
**Status:** PASS

77 passed, 0 failed

## Implementation Notes
- The retry logic in `handlePlannerComplete` uses `model` (not `updatedModel`) to preserve the executor in `activeExecutors`, matching the plan's instruction about line 3120 removing the executor
- On resume, ClaudeCode sets `systemPrompt = Nothing` so `--system-prompt` is omitted (the session already has one); OpenCode skips the `FileSystem.writeFile` for AGENTS.md entirely
- The `sessionId` is stored on the executor immediately when `AgentCompleted` arrives (before forwarding to the executor state machine), so it is available for the retry check in `handlePlannerComplete`
- After retry, `sessionId` is cleared on the executor to prevent stale session IDs from persisting if the retry also fails
- The OpenCode provider's `runCli` task was extracted as a shared binding to avoid duplicating the CLI execution logic between the resume and non-resume paths

## Iteration
1
