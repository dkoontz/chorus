# QA Report - Phase 2: Extract shared tool execution

## Summary

Phase 2 adds `ToolCallResult` type and `executeToolCall` function to `Web/ToolExecution.gren`. All builds compile cleanly (24 modules), all 77 unit tests pass, the full distribution build succeeds, and no regressions were found. The implementation matches the plan specification exactly.

## Test Scenarios

### Scenario 1: Build compiles cleanly
- **Description:** Verify `npm run build:all` compiles without errors after Phase 2 changes
- **Steps:**
  1. Run `npm run build:all` in the worktree
- **Expected:** All three packages (chorus-ui, tools, chorus) compile successfully
- **Actual:** All compiled successfully. chorus-ui: 13 modules, tools: 5 modules, chorus: 24 modules.
- **Status:** PASS

### Scenario 2: All unit tests pass
- **Description:** Verify `npm run test` passes with no failures
- **Steps:**
  1. Run `npm run test` in the worktree
- **Expected:** All tests pass (77 tests, 0 failures)
- **Actual:** 77 passed, 0 failed
- **Status:** PASS

### Scenario 3: Distribution build succeeds
- **Description:** Verify `npm run build:dist` produces a complete distribution
- **Steps:**
  1. Run `npm run build:dist` in the worktree
- **Expected:** Build completes and assembles dist/ directory
- **Actual:** Build completed successfully, "dist/ assembled."
- **Status:** PASS

### Scenario 4: ToolCallResult type matches plan specification
- **Description:** Verify the `ToolCallResult` type alias matches the plan exactly
- **Steps:**
  1. Read `packages/chorus/src/Web/ToolExecution.gren`
  2. Compare `ToolCallResult` definition against Phase 2 plan specification
- **Expected:** Fields are `toolCallId : String`, `toolName : String`, `requestBody : String`, `result : ApiResult`
- **Actual:** All four fields present with correct types. `result` uses `Api.ApiResult` (module-qualified, which is correct).
- **Status:** PASS

### Scenario 5: executeToolCall function signature matches plan
- **Description:** Verify function signature matches `ToolExecutionContext -> { id, name, input } -> (ToolCallResult -> msg) -> Cmd msg`
- **Steps:**
  1. Read the function type annotation in `Web/ToolExecution.gren`
  2. Compare against plan specification
- **Expected:** Signature matches plan exactly
- **Actual:** `executeToolCall : ToolExecutionContext -> { id : String, name : String, input : Decode.Value } -> (ToolCallResult -> msg) -> Cmd msg` -- matches plan.
- **Status:** PASS

### Scenario 6: JSON encoding produces correct request body format
- **Description:** Verify the implementation encodes `{"tool": name, ...input_fields}` as specified
- **Steps:**
  1. Read the `requestBody` construction in `executeToolCall`
  2. Verify it decodes input as key-value pairs and prepends `{"tool": name}`
- **Expected:** Input fields are merged with `{"tool": name}` into a flat JSON object
- **Actual:** Uses `Decode.keyValuePairs Decode.value` to extract input fields, `Array.pushFirst` to prepend the tool name, and `Encode.object` to produce the final JSON string. This correctly produces `{"tool":"name",...inputFields}`.
- **Status:** PASS

### Scenario 7: Permission checking mirrors requestExecuteTool
- **Description:** Verify `executeToolCall` applies the same permission logic as `requestExecuteTool`
- **Steps:**
  1. Compare permission checking code in both functions
  2. Verify auto-grant for `completion-report` and `planner-output`
  3. Verify `checkPermission` is called for all other tools
  4. Verify denied tools return 403 FORBIDDEN ApiError
- **Expected:** Identical permission logic in both code paths
- **Actual:** Both functions auto-grant `completion-report` and `planner-output`, both call `checkPermission` for other tools, and both return the same `Api.ApiError { statusCode = 403, code = "FORBIDDEN", message = reason }` for denied tools.
- **Status:** PASS

### Scenario 8: Result wrapping includes correlation data
- **Description:** Verify `ToolCallResult` is populated with id, name, and requestBody for correlation
- **Steps:**
  1. Read the `wrapResult` function inside `executeToolCall`
- **Expected:** `toolCallId = toolCall.id`, `toolName = toolCall.name`, `requestBody = requestBody`, `result = apiResult`
- **Actual:** All four fields correctly populated in the `wrapResult` helper function.
- **Status:** PASS

### Scenario 9: Existing requestExecuteTool preserved
- **Description:** Verify the existing HTTP tool execution path is unchanged
- **Steps:**
  1. Check that `requestExecuteTool` is still in the module exports
  2. Verify its implementation is unchanged (no diff in existing code)
- **Expected:** `requestExecuteTool` remains exported and unchanged
- **Actual:** `requestExecuteTool` is still exported and its implementation is identical to pre-Phase 2. The git diff shows only additions -- no modifications to existing functions.
- **Status:** PASS

### Scenario 10: Module exports updated correctly
- **Description:** Verify `ToolCallResult` and `executeToolCall` are exported from the module
- **Steps:**
  1. Read the module export list at the top of `Web/ToolExecution.gren`
- **Expected:** Both `ToolCallResult` and `executeToolCall` appear in the exposing list
- **Actual:** Module exports: `ToolCallResult`, `ToolExecutionContext`, `ToolPermission(..)`, `checkPermission`, `completionReportInputDecoder`, `executeToolCall`, `requestExecuteTool`. Both new exports present.
- **Status:** PASS

### Scenario 11: No regressions in existing module consumers
- **Description:** Verify that `Main.gren` (the only consumer of `Web.ToolExecution`) still compiles
- **Steps:**
  1. Verify `Main.gren` imports `Web.ToolExecution as ToolExecution`
  2. Confirm build success with 24 modules compiled
- **Expected:** No compilation errors in downstream modules
- **Actual:** Build succeeds. `Main.gren` imports the module and compiles without errors.
- **Status:** PASS

### Scenario 12: Graceful handling of non-object input
- **Description:** Verify `executeToolCall` handles edge case where `toolCall.input` is not a JSON object
- **Steps:**
  1. Read the `Result.withDefault []` fallback in the `requestBody` construction
- **Expected:** Non-object input falls back to `[]`, producing `{"tool":"name"}` with no input fields
- **Actual:** `Decode.keyValuePairs` fails for non-objects, `Result.withDefault []` produces empty fields, result is `{"tool":"name"}`. Downstream tool dispatcher handles missing fields with its own error responses. Acceptable graceful degradation.
- **Status:** PASS

## Failures

None.

## Test Code Quality Issues

No new test code was added in this phase. The `executeToolCall` function is a new internal entry point that is not yet called by any production code -- it will be wired in during Phase 3 (Executor refactor) and Phase 4 (Main.gren wiring). Unit testing this function in isolation would require mocking the Gren Task/Cmd system, filesystem permissions, and the registry, which is not practical in the current test framework. The function's correctness is validated by: (a) the Gren compiler's type checking (the build succeeds), and (b) its structural equivalence to the already-tested `requestExecuteTool` code path.

## Integration Tests Added

No integration tests were added. This phase introduces an internal Gren function (`executeToolCall`) that is not yet invoked by any code path. It cannot be tested through the `chorus-tools` integration test framework, which tests externally-invocable tools (file.read, file.write, etc.). Integration testing of `executeToolCall` will become possible and necessary in Phase 4 when it is wired into the Main.gren event loop and tool calls flow through it end-to-end.

## Overall Assessment

**Decision:** PASS

The Phase 2 implementation is correct and complete:
- `ToolCallResult` type matches the plan specification exactly
- `executeToolCall` function signature and implementation match the plan
- JSON encoding correctly produces `{"tool": name, ...input_fields}` format
- Permission checking is identical to the existing `requestExecuteTool`
- Result wrapping includes all correlation data (id, name, requestBody)
- Existing `requestExecuteTool` is preserved unchanged for backwards compatibility
- Build compiles cleanly (24 modules)
- All 77 unit tests pass
- Distribution build succeeds
- No regressions detected
