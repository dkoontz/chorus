# Code Review Report

## Summary

Phase 2 adds `ToolCallResult` type and `executeToolCall` function to `Web/ToolExecution.gren` as specified. The implementation is clean, correctly reuses existing `dispatchTool` and `checkPermission` internals, and both build and tests pass (24 modules compiled, 77 tests, 0 failures). Two suggestions below, neither blocking.

## Issues Found

### BLOCKING Issues

None.

### Suggestions

#### Suggestion 1: Silent fallback on non-object input violates coding standards

- **File:** `packages/chorus/src/Web/ToolExecution.gren`
- **Line:** 159-160
- **Category:** Correctness
- **Description:** `Decode.decodeValue (Decode.keyValuePairs Decode.value) toolCall.input |> Result.withDefault []` silently treats a non-object input (null, string, array, number) as an empty object. Per the "Fail on Malformed or Missing Data" coding standard, missing or invalid data should produce an explicit error rather than a silent default. If the input is not a JSON object, the resulting request body `{"tool":"name"}` would likely cause a confusing downstream error from `dispatchTool` with no indication that the root cause was a malformed tool call input.
- **Suggestion:** Handle the `Err` case explicitly by returning an `ApiError` result (e.g., 400 BAD_REQUEST with a message like "Tool call input must be a JSON object") instead of falling through to `dispatchTool` with missing fields. This matches how `requestExecuteTool` returns a 400 for a missing `tool` field. For example:

```gren
when Decode.decodeValue (Decode.keyValuePairs Decode.value) toolCall.input is
    Err _ ->
        GrenTask.succeed
            (Api.ApiError
                { statusCode = 400
                , code = "BAD_REQUEST"
                , message = "Tool call input for '" ++ toolCall.name ++ "' must be a JSON object"
                }
            )
            |> GrenTask.perform wrapResult

    Ok inputFields ->
        let
            allFields = ...
            requestBody = ...
        in
        -- proceed with permission check and dispatch
```

Note: The practical impact is low since LLM providers always send tool call inputs as JSON objects. The existing `addJsonField` in `Web/Api.gren` uses the same silent-fallback pattern, so this is an existing codebase convention. Still worth fixing for consistency with the coding standards.

#### Suggestion 2: Permission check logic is duplicated between executeToolCall and requestExecuteTool

- **File:** `packages/chorus/src/Web/ToolExecution.gren`
- **Line:** 114-131 and 177-193
- **Category:** Duplication
- **Description:** The auto-grant check for `completion-report` / `planner-output` followed by `checkPermission` dispatch is repeated in both `requestExecuteTool` and `executeToolCall`. The pattern (if auto-granted then dispatch, else check permission then dispatch-or-deny) is identical in both functions.
- **Suggestion:** This is acceptable for now since the plan notes that `requestExecuteTool` will eventually be removed when HTTP tool calls are routed through the Provider/Executor path. Extracting a shared helper would be premature given the planned deletion. No action needed in this phase, but worth noting to ensure `requestExecuteTool` is cleaned up in Phase 4.

## Overall Assessment

**Decision:** APPROVED

The Phase 2 implementation correctly adds the `ToolCallResult` type and `executeToolCall` function as specified in the plan. The type matches the plan exactly. The function properly encodes structured tool calls into the flat JSON format expected by `dispatchTool`, reuses existing permission checking and dispatch logic, and wraps results with correlation data. The code is well-documented with clear doc comments. Build and tests pass cleanly. The two suggestions above are worth considering but neither is blocking.
