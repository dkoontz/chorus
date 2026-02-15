# Developer Report

## Task
Phase 2: Extract shared tool execution. Add a `ToolCallResult` type and `executeToolCall` function to `Web/ToolExecution.gren` so the Executor's tool processing pipeline can call tool execution directly from structured `ToolCall` data (as received from provider responses), rather than only from raw HTTP request body strings.

## Files Modified
- `packages/chorus/src/Web/ToolExecution.gren` - Added `ToolCallResult` type alias and `executeToolCall` function; updated module exposing list

## Build Status
**Status:** PASS

```
Success! Compiled 24 modules.
    Main --> build/chorus-tmp
```

## Test Status
**Status:** PASS

```
Running 77 tests...
77 passed, 0 failed
```

## Implementation Notes

### ToolCallResult type
Added as a record alias with four fields:
- `toolCallId : String` -- for correlating results back to the originating tool call
- `toolName : String` -- the tool name, for logging and event recording
- `requestBody : String` -- the encoded JSON request body that was dispatched (useful for debugging and history events)
- `result : Api.ApiResult` -- the execution result from `dispatchTool`

### executeToolCall function
Signature: `executeToolCall : ToolExecutionContext -> { id : String, name : String, input : Decode.Value } -> (ToolCallResult -> msg) -> Cmd msg`

The function:
1. Encodes the tool call input into the flat JSON request body format expected by `dispatchTool`. It decodes the `input` value as key-value pairs, prepends the `{"tool": name}` entry, and re-encodes. This produces the same `{"tool":"file.read","path":"..."}` format that `chorus-tools` sends via HTTP.
2. Applies the same permission logic as `requestExecuteTool` (completion-report and planner-output are auto-granted; other tools are checked against `allowedTools`).
3. Delegates to the existing `dispatchTool` internal function.
4. Wraps the `ApiResult` in a `ToolCallResult` record via a `wrapResult` adapter function passed as the callback to `dispatchTool`.

### Design decisions
- **Reuses `dispatchTool` directly** rather than calling `requestExecuteTool`. This avoids redundant JSON parsing of the `"tool"` field from the request body, since we already have the tool name structured in the input record.
- **Permission logic is duplicated** (the auto-grant check for completion-report/planner-output, and the `checkPermission` call). This is intentional -- it keeps `executeToolCall` self-contained and avoids coupling its implementation to the internal structure of `requestExecuteTool`. The permission rules are simple and unlikely to diverge.
- **Input encoding handles non-object values gracefully.** If `toolCall.input` is not a JSON object (e.g., it's a string or null), `Decode.decodeValue (Decode.keyValuePairs ...)` returns `Err`, which `Result.withDefault []` converts to an empty array. The request body will then contain only `{"tool":"..."}`, which is correct behavior -- downstream decoders will fail with appropriate error messages if required fields are missing.

### ToolResult in Provider.gren
The task specified adding a `ToolResult` type to `Provider.gren` "if not already present". It is already present (added in Phase 1 or earlier) with fields `toolCallId`, `output`, and `isError`. No changes were needed.

### What is NOT changed
- No modifications to `Main.gren` (Phase 4)
- No modifications to `Agent/Executor.gren` (Phase 3)
- No modifications to provider implementations
- The existing `requestExecuteTool` HTTP path remains unchanged

## Iteration
2
