# Code Review Report

## Summary

The implementation is well-structured and follows the existing patterns in the codebase. There are two correctness concerns that should be addressed: the `fetchTask` function does not check HTTP status codes (which could cause the polling loop to silently misinterpret error responses), and the `currentAgent` decoding silently defaults to `Nothing` on parse failures (which could cause premature completion detection).

## Issues Found

### BLOCKING Issues

#### Issue 1: fetchTask does not check HTTP status codes
- **File:** `packages/tools/src/Tools/Handoff.gren`
- **Line:** 217-241
- **Category:** Correctness
- **Description:** The `fetchTask` function uses `curl -s url` without the `-w "\n%{http_code}"` flag that `startHandoff` uses. This means if the GET request returns a 404, 500, or any other error status, the raw error response body is returned as if it were valid task JSON. The downstream `Decode.decodeString` in `pollForCompletion` will then attempt to parse it. For the `currentAgent` field, the decode failure is swallowed by `Result.withDefault Nothing` (see Issue 2), which would cause the tool to incorrectly conclude the agent has completed. For the `agentChain` output extraction, it would produce a `JsonParseError`, but the error message would be confusing since it would say "Could not extract agent output" when the real problem is the server returned an error.
- **Suggestion:** Add `-w "\n%{http_code}"` to the curl args in `fetchTask` (matching `startHandoff`), use `parseHttpResponse` to extract the status code, and fail with `HttpError` for non-2xx responses. This is the same pattern already used in `startHandoff` at line 98-147.

#### Issue 2: currentAgent decode failure silently defaults to Nothing
- **File:** `packages/tools/src/Tools/Handoff.gren`
- **Line:** 169-175
- **Category:** Correctness
- **Description:** The `currentAgent` field is decoded with `Result.withDefault Nothing`. This means if the JSON response is malformed, missing the `data` field, or has an unexpected structure, the decode will fail and default to `Nothing`. Since `Nothing` is interpreted as "agent completed," this causes the tool to prematurely declare success and attempt to extract the output from `agentChain`. This violates the project coding standard "Fail on Malformed or Missing Data" -- `Result.withDefault` is hiding a potential failure. A malformed API response, a network issue returning HTML instead of JSON, or an API change could all trigger this bug silently.
- **Suggestion:** Handle the `Result` explicitly. If decoding fails, return a `JsonParseError` with a message like "Could not parse task status from API response." Only treat `Ok Nothing` as agent-completed.

### Suggestions

#### Suggestion 1: lastOutput defaults to empty string on empty agentChain
- **File:** `packages/tools/src/Tools/Handoff.gren`
- **Line:** 195-198
- **Category:** Correctness
- **Description:** When `outputs` is decoded successfully but the array is empty, `Array.last` returns `Nothing` and `Maybe.withDefault ""` produces an empty string. An empty `agentChain` after a handoff would be an unexpected state -- it could indicate a server-side bug. Returning an empty string as the agent's output silently hides this problem. Per the coding standards, this is a case where a default is masking potentially invalid data.
- **Suggestion:** Consider failing with a `JsonParseError` when the `agentChain` array is empty, such as `"Agent chain is empty; expected at least one entry"`. This would make it easier to diagnose issues.

#### Suggestion 2: Duplicated curl options could be extracted to a helper
- **File:** `packages/tools/src/Tools/Handoff.gren`
- **Line:** 125-130 and 227-231
- **Category:** Duplication
- **Description:** The `options` record in both `startHandoff` and `fetchTask` is identical: same `shell`, `workingDirectory`, `environmentVariables`, `maximumBytesWrittenToStreams`, and `runDuration` values. If these defaults ever need to change (e.g., adjusting timeout or buffer size), both locations must be updated.
- **Suggestion:** Extract a `defaultCurlOptions` helper that returns the shared options record. Both `startHandoff` and `fetchTask` can use it.

#### Suggestion 3: Bytes.toString defaults to empty string in fetchTask
- **File:** `packages/tools/src/Tools/Handoff.gren`
- **Line:** 238-240
- **Category:** Correctness
- **Description:** `Bytes.toString` returning `Nothing` (which means the output is not valid UTF-8) is silently converted to `""` via `Maybe.withDefault ""`. This is a minor concern since curl output from an HTTP API would almost always be valid UTF-8, but per coding standards, it would be more correct to propagate this as an error.
- **Suggestion:** Consider mapping `Nothing` to a `CurlFailed { reason = "Response was not valid UTF-8" }` error. The same pattern appears in `parseHttpResponse` at line 257-258.

#### Suggestion 4: Consider naming consistency for error-to-string functions
- **File:** `packages/tools/src/Tools/Handoff.gren`
- **Line:** 59
- **Category:** Style
- **Description:** The function is named `handoffErrorToString`. The file tools module uses `fileErrorToString`, which follows the same pattern. However, both include the module name prefix in the function name. Since these are always called qualified (e.g., `Handoff.handoffErrorToString`, `File.fileErrorToString`), the prefix is redundant -- `Handoff.errorToString` and `File.errorToString` would be sufficient. This is not something that needs changing in this PR since it matches the existing convention, but it is worth noting for future consideration.
- **Suggestion:** No action needed now; this is consistent with the existing style in `Tools.File`.

## Overall Assessment

**Decision:** CHANGES REQUESTED

The two blocking issues are both correctness concerns in the polling logic. Issue 1 (missing HTTP status code checking in `fetchTask`) could cause confusing error messages when the server returns error responses during polling. Issue 2 (`Result.withDefault Nothing` on `currentAgent` decoding) could cause the tool to falsely report success when the API response is malformed, which is a more serious problem since it could silently return incorrect data. Both issues have clear fixes that follow patterns already established in the same file.
