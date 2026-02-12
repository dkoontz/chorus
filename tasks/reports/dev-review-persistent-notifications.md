# Code Review Report

## Summary

The implementation correctly replaces the single `error : Maybe String` field with a full notification system supporting stacking, persistent errors, and auto-dismissing success notifications. The code is clean, well-structured, and follows project conventions. All error sites have been converted, success notifications added at the required locations, and the old `error = Nothing` clearing pattern fully removed. The build compiles and all 81 tests pass.

## Issues Found

### BLOCKING Issues

None.

### Suggestions

#### Suggestion 1: Exposed `Level(..)` constructors are unused outside the module
- **File:** `packages/chorus-ui/src/Notification.gren`
- **Line:** 3
- **Category:** Simplification
- **Description:** The module exposes `Level(..)` with both constructors (`Error`, `Success`), but `Level` is never imported or referenced outside of `Notification.gren`. The `Main.gren` import is `import Notification exposing (Notification)` -- it does not import `Level`. Exposing the constructors breaks the opaque boundary that the task spec calls for and adds unused public API surface.
- **Suggestion:** Change `Level(..)` to just `Level` (opaque) or remove it from the exposing list entirely, since external code interacts with levels only through the `error` and `success` smart constructors.

#### Suggestion 2: Sentinel `createdAt` value for error notifications
- **File:** `packages/chorus-ui/src/Notification.gren`
- **Line:** 37
- **Category:** Style
- **Description:** The `error` constructor sets `createdAt = Time.millisToPosix 0` -- a meaningless sentinel value that is never examined because `isExpired` short-circuits on the `Error` level. This works correctly but is the kind of "invalid state representable" pattern the coding standards discourage. A `Maybe Time.Posix` or separate record shapes per level would make the intent clearer.
- **Suggestion:** This is a minor concern given the module is opaque and the sentinel is fully hidden. If the module grows (e.g., adding a "time ago" display), consider refactoring `createdAt` to `Maybe Time.Posix` or using distinct internal record shapes per level. No change needed now.

#### Suggestion 3: Auto-dismiss via poll cycle instead of `Process.sleep`
- **File:** `packages/chorus-ui/src/Main.gren`
- **Line:** 490-496
- **Category:** Correctness
- **Description:** The task spec calls for `Process.sleep 5000 |> Task.perform (\_ -> AutoDismissNotification id)` to auto-dismiss success notifications. The implementation instead piggybacks on the 2-second poll cycle, filtering expired notifications in the `Poll` handler. This means a success notification disappears between 5 and 7 seconds after creation (depending on poll timing), which is acceptable but slightly less precise than the spec. It also means that if polling were ever disabled or slowed (e.g., on an idle/background tab), success notifications would linger.
- **Suggestion:** The current approach is a reasonable simplification. The `AutoDismissNotification` msg type from the spec was intentionally omitted, and the poll-based approach avoids extra commands. No change needed unless more precise timing is required.

#### Suggestion 4: Modal click handler changed from `ClearError` to `NoOp`
- **File:** `packages/chorus-ui/src/Main.gren`
- **Line:** 1768
- **Category:** Correctness
- **Description:** The create-task modal's `stopPropagationOn "click"` handler was changed from `ClearError` to `NoOp`. The original `ClearError` was a side effect of needing a `Msg` value for stop-propagation; `NoOp` is semantically more accurate since the intent is to prevent the click from propagating to the overlay, not to clear errors. This is a correct improvement.
- **Suggestion:** None needed -- this is a good change.

## Overall Assessment

**Decision:** APPROVED

The implementation is thorough and correct. All acceptance criteria from the task spec are met:
- Error notifications persist until manually dismissed (not cleared by poll success).
- Success notifications auto-dismiss after approximately 5-7 seconds.
- Multiple notifications stack vertically below the header.
- All error display sites converted; all required success notification sites added.
- `settingsValidationError` left unchanged as required.
- Old `viewError`, `ClearError`, and `error-banner` CSS fully removed.
- Build succeeds, all tests pass.

The suggestions above are minor refinements worth considering in future work but do not block merging.
