# Developer Report

## Task
Replace `Http.expectJson` with a custom `expectApiResponse` helper across all API endpoints so that error messages from the server's JSON error responses are extracted and displayed to the user, instead of being discarded as generic "Server error: N" messages.

## Files Modified
- `packages/chorus-ui/src/Api.gren` - Added generic `expectApiResponse` helper using `Http.expectStringResponse`; replaced all 21 uses of `Http.expectJson` with `expectApiResponse`; exported `expectApiResponse` from the module
- `packages/chorus-ui/src/Main.gren` - Updated `httpErrorToString` to render `BadBody` messages directly (without "Invalid response:" prefix); removed now-redundant `configErrorToString` function; updated `GotConfig` error handler to use `httpErrorToString`

## Build Status
**Status:** PASS

```
Success! Compiled 13 modules.
    Main ───> build/app.js
...
dist/ assembled.
```

## Test Status
**Status:** PASS

```
Running 62 tests...
62 passed, 0 failed

Running 19 integration tests...
19 passed, 0 failed
```

## Implementation Notes

- The new `expectApiResponse` function generalizes the existing `expectConfigResponse` pattern. It takes a `(Result Http.Error a -> msg)` callback and a `Decoder a`, uses `Http.expectStringResponse` internally, and on `BadStatus_` responses attempts to decode `{"error":{"message":"..."}}` from the body. If extraction fails, the raw body string is used as the error message.

- On success (`GoodStatus_`), the decoder is applied to the body. On decode failure, the error string is passed as `Http.BadBody`.

- The `expectConfigResponse` function is left in place because it has a different shape: it does not take a decoder parameter (the config response decoder is hardcoded within it, and it decodes a `ConfigResponse` that includes both `data` and `configPath` fields from the top-level response). The config endpoints continue to work exactly as before.

- `httpErrorToString` was updated so that `BadBody` errors (which now carry the server's error message) are displayed directly without the "Invalid response:" prefix. This means both API error messages from the server (e.g., "Server initializing") and JSON decode errors will be shown as-is. This is the correct behavior: both are meaningful error messages that should be surfaced to the user.

- The `configErrorToString` function was removed because its only purpose was to strip the "Invalid response:" prefix for `BadBody` errors from config endpoints. Now that `httpErrorToString` handles `BadBody` the same way, the separate function is unnecessary. The one call site in `GotConfig` was updated to use `httpErrorToString`.

## Iteration
1
