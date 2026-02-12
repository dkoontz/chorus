# Code Review Report

## Summary

The implementation correctly generalizes the existing `expectConfigResponse` pattern into a reusable `expectApiResponse` helper and applies it to all non-config API endpoints. The change is clean and well-scoped, but `expectConfigResponse` is now fully duplicated by `expectApiResponse` and should be replaced.

## Issues Found

### BLOCKING Issues

#### Issue 1: `expectConfigResponse` is now a complete duplicate of `expectApiResponse`
- **File:** `packages/chorus-ui/src/Api.gren`
- **Line:** 479-511
- **Category:** Duplication
- **Description:** `expectConfigResponse` is now structurally identical to `expectApiResponse` with the decoder hardcoded to `configResponseDecoder`. The developer report acknowledges this, stating the function was "left in place because it has a different shape: it does not take a decoder parameter." However, this is not a meaningful difference -- it is exactly the duplication that the new generic function was designed to eliminate. The entire body of `expectConfigResponse` (BadUrl_, Timeout_, NetworkError_, BadStatus_ with error extraction, GoodStatus_ with decode) is duplicated line-for-line from `expectApiResponse`. The config endpoints can simply use `expectApiResponse toMsg configResponseDecoder`.
- **Suggestion:** Replace the four call sites (`getConfig`, `updateConfig`, `selectConfig`, `createConfig`) to use `expectApiResponse toMsg configResponseDecoder` instead of `expectConfigResponse toMsg`, then remove the `expectConfigResponse` function entirely.

### Suggestions

#### Suggestion 1: `BadBody` now conflates server error messages with JSON decode failures
- **File:** `packages/chorus-ui/src/Main.gren`
- **Line:** 1963-1964
- **Category:** Correctness
- **Description:** The `httpErrorToString` function now renders all `BadBody` messages directly (without a prefix). This means both server error messages (e.g., "Server initializing") and JSON decode failures (e.g., "Expecting an OBJECT with a field named `data`") are displayed identically to the user. A JSON decode error is a fundamentally different kind of failure than a server-reported error -- it indicates a bug in the UI or an unexpected response format, not a user-facing condition. Users seeing a raw decoder error string like "Expecting an OBJECT with a field named `data`" would find that confusing.
- **Suggestion:** Consider distinguishing between the two cases. One approach: in `expectApiResponse`, use a different error variant or a distinguishing prefix for decode failures on successful responses (the `GoodStatus_` branch) vs. server error messages on failed responses (the `BadStatus_` branch). For instance, keep the "Invalid response:" prefix for decode failures in `GoodStatus_`, and only strip it for `BadStatus_` messages. This is a minor UX concern rather than a functional bug, so it is a suggestion rather than blocking.

## Overall Assessment

**Decision:** CHANGES REQUESTED

The blocking issue is the full duplication of `expectConfigResponse`. The new `expectApiResponse` is a strict generalization of `expectConfigResponse` -- it takes the same `toMsg` parameter plus a decoder, and the body is identical. Leaving both in place defeats the purpose of the refactoring described in the task plan ("generalizes that pattern to all API endpoints"). The fix is straightforward: replace the four config call sites with `expectApiResponse toMsg configResponseDecoder` and remove `expectConfigResponse`.
