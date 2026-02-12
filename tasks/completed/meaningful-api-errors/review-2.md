# Code Review Report

## Summary

The iteration 2 changes cleanly address both issues from the first review: the duplicate `expectConfigResponse` has been removed, and server error messages are now distinguishable from JSON decode failures in `BadBody`. The implementation is correct and well-structured.

## Issues Found

### BLOCKING Issues

None.

### Suggestions

#### Suggestion 1: String-based discrimination of BadBody error sources is fragile

- **File:** `packages/chorus-ui/src/Main.gren`
- **Line:** 1963-1967
- **Category:** Correctness
- **Description:** The `httpErrorToString` function uses `String.startsWith "Invalid response: "` to distinguish decode failures from server error messages. This works today because `expectApiResponse` controls both prefix conventions. However, it couples two modules via an implicit string protocol -- if the prefix in `Api.gren` changes or a server happens to return an error message starting with "Invalid response: ", the logic silently breaks. This is a minor fragility, not a bug in the current code.
- **Suggestion:** This is acceptable for now given that `Http.Error` is a library type and cannot be extended with custom variants. If more error categories are needed in the future, consider introducing a project-level error type (e.g., `type ApiError = ServerError String | DecodeError String | ...`) that replaces `Http.Error` in the `Result` returned from API calls. This would make the discrimination type-safe rather than string-based.

#### Suggestion 2: BadStatus_ discards the status code

- **File:** `packages/chorus-ui/src/Api.gren`
- **Line:** 455-465
- **Category:** Correctness
- **Description:** The `BadStatus_` branch destructures only `{ body }` and converts to `Http.BadBody errorMessage`, discarding the HTTP status code entirely. The `httpErrorToString` handler for `BadStatus` (which returns `"Server error: " ++ status`) becomes unreachable for all endpoints using `expectApiResponse`, since those errors now always arrive as `BadBody`. This means the user never sees the numeric status code in error messages. For most users, "Server error: Server initializing" is better than "Server error: 503", so this is arguably an improvement. But if the server returns a non-JSON error body (e.g., an HTML error page from a reverse proxy), the user will see the raw HTML string prefixed with "Server error: ", which could be confusing.
- **Suggestion:** Consider including the status code in the fallback path when `errorMessageDecoder` fails to parse the body. For example: `Err _ -> "Status " ++ String.fromInt statusCode ++ ": " ++ body` (after also destructuring the status code from `BadStatus_`). Alternatively, if the error body is not valid JSON, fall back to `Http.BadStatus statusCode` to preserve the original behavior for non-JSON error responses. This is a minor edge case and not blocking.

## Overall Assessment

**Decision:** APPROVED

Both review items from iteration 1 have been addressed correctly. The `expectConfigResponse` duplication is eliminated, all 24 API call sites consistently use `expectApiResponse`, and the "Invalid response: " prefix convention provides a clean separation between server errors and decode failures. The build passes and all 81 tests (62 unit + 19 integration) pass. The suggestions above are minor improvements worth considering in future work but do not block this change.
