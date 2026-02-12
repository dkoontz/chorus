# Meaningful API Errors

## Summary

The server returns structured error responses with meaningful messages, but the UI discards them when using `Http.expectJson`. Replace `Http.expectJson` with a custom expect function that extracts error messages from the response body on non-2xx status codes, matching the pattern already used by the config endpoints.

## Background

After creating a new workspace, the user sees "Server error: 503" with no additional context. The server sends `{"error":{"code":"SERVICE_UNAVAILABLE","message":"Server initializing"}}` but the UI's `Http.expectJson` only returns `Http.BadStatus 503`, discarding the body entirely.

The config endpoints (`getConfig`, `updateConfig`, `selectConfig`, `createConfig`) already solve this using `expectConfigResponse` with `Http.expectStringResponse`. This task generalizes that pattern to all API endpoints.

## Requirements

- Create a generic `expectApiResponse` helper in `packages/chorus-ui/src/Api.gren` that uses `Http.expectStringResponse` to extract `{"error":{"message":"..."}}` from error response bodies, similar to the existing `expectConfigResponse`
- Replace all uses of `Http.expectJson` in `Api.gren` with this new helper
- Update `httpErrorToString` in `packages/chorus-ui/src/Main.gren` to render extracted error messages cleanly
- No changes to server-side code (it already returns meaningful error JSON)

## Acceptance Criteria

- [ ] When the registry is not initialized (503), the UI shows the server's error message (e.g., "Server initializing") instead of "Server error: 503"
- [ ] When a request body is malformed (400), the UI shows the server's error message instead of "Server error: 400"
- [ ] When a resource is not found (404), the UI shows the server's error message instead of "Server error: 404"
- [ ] When there is a conflict (409), the UI shows the server's error message instead of "Server error: 409"
- [ ] When there is a server error (500), the UI shows the server's error message instead of "Server error: 500"
- [ ] Config endpoints continue working as before
- [ ] App builds successfully (`npm run build:all`)
- [ ] Tests pass (`npm run test`)

## Out of Scope

- Changing any server-side error responses
- Adding new error types or error codes
- Changing error notification styling or behavior

## Files to Modify

- `packages/chorus-ui/src/Api.gren` — Add `expectApiResponse` helper, replace all `Http.expectJson` calls
- `packages/chorus-ui/src/Main.gren` — Update `httpErrorToString` to render extracted error messages cleanly

## Patterns to Follow

The existing `expectConfigResponse` in `Api.gren` is the exact pattern to generalize. It uses `Http.expectStringResponse`, extracts `{"error":{"message":"..."}}` on `BadStatus_`, and converts to `Http.BadBody errorMessage`.
