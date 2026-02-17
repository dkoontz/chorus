# Code Review Report

## Summary

Phase 1 adds the new unified provider interface types (`UnifiedProvider`, `StartConfig`, `ProviderEvent`, `ProviderState`, `HttpToolCallContext`) alongside the existing legacy `Provider` type in `Provider.gren`. The implementation faithfully matches the plan specification. The code compiles (24 modules) and all 77 tests pass. No breaking changes to existing code.

## Issues Found

### BLOCKING Issues

None.

### Suggestions

#### Suggestion 1: Import alias inconsistency for HttpServer.Response

- **File:** `packages/chorus/src/Provider.gren`
- **Line:** 48
- **Category:** Style
- **Description:** The import uses `import HttpServer.Response as HttpResponse`, but the rest of the codebase consistently aliases this module as `Response` (e.g., `import HttpServer.Response as Response exposing (Response)` in Main.gren, Web/Api.gren, Web/Static.gren). Using `HttpResponse` as the alias is not wrong, but it deviates from the established convention.
- **Suggestion:** Change to `import HttpServer.Response as Response exposing (Response)` to match the codebase convention. Alternatively, if `Response` would be ambiguous in this module, the current alias is acceptable -- just be aware it differs from the pattern used elsewhere.

#### Suggestion 2: Consider storing `onEvent` callback in `ApiProviderState` for future phases

- **File:** `packages/chorus/src/Provider.gren`
- **Line:** 299-301
- **Category:** Correctness
- **Description:** The `deliverToolResults` function returns `{ state : ProviderState, cmd : Cmd msg }` but does not receive an `onEvent` callback. For API providers, `deliverToolResults` triggers a new LLM API call that may return tool calls or signal completion, requiring the provider to emit `ProviderEvent` values. The `onEvent` callback is only provided via `StartConfig` in `startAgent`, so API providers would need to capture it during `startAgent` and store it in `ApiProviderState` for later use. Currently `ApiProviderState` only holds `{ session : Maybe Session }`, which may be insufficient. This matches the plan spec as written and is not a problem for Phase 1, but will need attention in Phase 6 when API providers are implemented.
- **Suggestion:** No action needed now. When implementing Phase 6, extend `ApiProviderState` to include the `onEvent` callback, or consider adding `onEvent` as a parameter to `deliverToolResults`. Document this as a known consideration for Phase 6.

#### Suggestion 3: Naming of `UnifiedProvider` is transitional

- **File:** `packages/chorus/src/Provider.gren`
- **Line:** 231
- **Category:** Naming
- **Description:** The type is named `UnifiedProvider` to avoid conflict with the legacy `Provider` type. This is the right choice for now, but once the legacy `Provider` type is removed (presumably after Phase 4 or Phase 6), the name `UnifiedProvider` will feel redundant -- it should just be `Provider`. The plan spec uses the name `Provider` for this type.
- **Suggestion:** Plan to rename `UnifiedProvider` back to `Provider` once the legacy type is deleted, as part of whatever phase removes the old interface. No action needed in Phase 1.

## Overall Assessment

**Decision:** APPROVED

The implementation is clean, well-documented, and faithful to the plan specification. The type definitions are correct and follow Gren conventions. The developer made a sound pragmatic choice using sum type variants for `ProviderState` instead of the plan's "opaque" language, since Gren lacks existential types. Doc comments are thorough and explain the purpose of each type clearly. The code compiles and tests pass. The three suggestions above are minor and appropriate for consideration in future phases rather than blocking this change.
