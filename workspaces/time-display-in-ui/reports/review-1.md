# Code Review Report

## Summary

The implementation is clean and well-structured. A shared `FormatTime` module correctly replaces three duplicate `formatTimestamp` functions across the Board, TaskDetail, and History views. The code follows project conventions, builds successfully, and all tests pass. One potential correctness issue around DST transitions in the `dayStart` function is noted as a suggestion.

## Issues Found

### BLOCKING Issues

No blocking issues found.

### Suggestions

#### Suggestion 1: DST edge case in `dayStart` may shift midnight by one hour

- **File:** `packages/chorus-ui/src/FormatTime.gren`
- **Line:** 57-75
- **Category:** Correctness
- **Description:** The `dayStart` function computes midnight by subtracting the local time-of-day offset from the POSIX millis. This works correctly for the vast majority of cases. However, during a DST spring-forward transition (e.g., clocks jump from 2:00 AM to 3:00 AM), the local hour/minute/second values already reflect the adjusted time, so the subtraction should still land on midnight. The one edge case is if `now` falls in the "skipped" hour (which cannot actually occur since those local times do not exist), so this is theoretically safe. During fall-back transitions, the same local time occurs twice, but `Time.toHour` etc. in Gren/Elm return the correct wall-clock time for the POSIX instant, so the subtraction remains correct. This is a low-risk note for awareness rather than a required fix.
- **Suggestion:** Consider adding a brief comment in `dayStart` noting that the approach relies on `Time.toHour`/`Time.toMinute`/`Time.toSecond` returning wall-clock values for the specific POSIX instant, which makes it DST-safe.

#### Suggestion 2: Consider extracting the time string construction

- **File:** `packages/chorus-ui/src/FormatTime.gren`
- **Line:** 24-25
- **Category:** Simplification
- **Description:** The `timeStr` construction (`padInt (Time.toHour zone timestamp) ++ ":" ++ padInt (Time.toMinute zone timestamp)`) is computed once at the top of `format` and used in all three branches. This is already well-structured. As a minor readability improvement, you could extract it to a named helper like `formatTime : Time.Zone -> Time.Posix -> String` for slightly better self-documentation, though the current approach is perfectly clear.
- **Suggestion:** Optional: extract `timeStr` into a small named helper `formatTime zone posix = padInt (Time.toHour zone posix) ++ ":" ++ padInt (Time.toMinute zone posix)` for reuse if other modules ever need just the time portion. This is purely a readability preference.

#### Suggestion 3: `viewAttachment` receives both decomposed args and full `Props`

- **File:** `packages/chorus-ui/src/View/TaskDetail.gren`
- **Line:** 235
- **Category:** Style
- **Description:** The `viewAttachment` function signature is `viewAttachment : Time.Zone -> Time.Posix -> Props msg -> String -> Types.Attachment -> Html msg`. It receives `zone` and `now` as separate arguments even though they are also available inside the `Props` record that is passed as the third argument. The call site at line 217 passes `props.zone props.now props tid`, decomposing and re-passing values that already exist in `props`.
- **Suggestion:** Consider either passing only `props` and extracting `zone`/`now` inside the function body, or only passing the individual values without `props`. The current approach works correctly but is slightly redundant.

## Overall Assessment

**Decision:** APPROVED

The implementation is solid and fulfills all task requirements. The shared `FormatTime` module is well-documented, correctly handles the "Today"/"Yesterday" special cases, and is properly integrated into all three views. The `Time.Zone` is obtained on init, `lastPoll` is reused as the "now" reference, and all old duplicate `formatTimestamp` functions have been cleanly removed. The code follows the project's naming conventions, pipe operator style, and module structure. The build and all 55 tests (36 unit + 19 integration) pass. The suggestions above are minor style/documentation improvements worth considering in future work.
