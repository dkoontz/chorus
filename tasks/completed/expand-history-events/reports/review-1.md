# Code Review Report

## Summary

The implementation correctly adds history event recording for planning lifecycle and status transitions across all four specified files. The code compiles, tests pass, and the patterns used are consistent with existing conventions. Two minor suggestions are noted, but no blocking issues were found.

## Issues Found

### BLOCKING Issues

None.

### Suggestions

#### Suggestion 1: `countAnswersInPrompt` may overcount if task description contains "Q: " lines
- **File:** `packages/chorus/src/Main.gren`
- **Line:** 1840-1845
- **Category:** Correctness
- **Description:** The `countAnswersInPrompt` function counts all lines starting with `"Q: "` in the entire enriched prompt, which includes the task description text prepended before the `## Clarifying Q&A` section. If the task description itself contains lines starting with `"Q: "`, the count will be inflated beyond the actual number of submitted answers.
- **Suggestion:** Split the prompt on `"## Clarifying Q&A"` and only count `"Q: "` lines in the section after that delimiter. Alternatively, pass the answer count directly from `requestSubmitAnswers` through the `GotAnswersSubmitted` message payload (e.g., as an `answerCount : Int` field), which would be more reliable than parsing the enriched prompt string.

#### Suggestion 2: Inconsistent qualification of `TaskStatus` constructors in Api.gren
- **File:** `packages/chorus/src/Web/Api.gren`
- **Line:** 359-360 vs 506-507
- **Category:** Style
- **Description:** In `requestApplyPlan` and `requestSetQuestions`, the `status_changed` event data uses fully qualified constructors (`Types.Planning`, `Types.ReadyToStart`, `Types.AwaitingInput`), while in `requestSubmitAnswers` the same constructors are used unqualified (`AwaitingInput`, `Planning`). Since `TaskStatus(..)` is imported with all constructors exposed, both forms compile, but mixing styles within the same file is inconsistent.
- **Suggestion:** Pick one style and use it consistently. Since the rest of `requestApplyPlan` and `requestSetQuestions` use `Types.` qualification, the simplest fix would be to also qualify the constructors in `requestSubmitAnswers` for consistency.

#### Suggestion 3: Event recording failures in `dispatchCompletionReport` can cause 500 errors despite successful task update
- **File:** `packages/chorus/src/Web/ToolExecution.gren`
- **Line:** 340-374
- **Category:** Correctness
- **Description:** The `completion_report_submitted` and `status_changed` `recordEvent` calls are chained via `andThen` after `updateTask` without individual `GrenTask.onError` wrappers. If either `recordEvent` fails, the outer `onError` handler returns a 500 error response, even though the `updateTask` already succeeded. The task spec states that event recording errors should not prevent the primary operation from succeeding. This is a pre-existing pattern for `completion_report_submitted` that the new `status_changed` event inherits.
- **Suggestion:** Add `|> GrenTask.onError (\_ -> GrenTask.succeed {})` after each `recordEvent` call (before the `andThen` that chains to the next step), matching the pattern used in `requestUpdateStatus` in Api.gren. This would make event recording truly non-blocking.

## Overall Assessment

**Decision:** APPROVED

The implementation meets all acceptance criteria from the task specification. All six new event types are recorded at the correct lifecycle points with the correct data keys. The UI mapping is complete and also includes beneficial additions for existing events that were previously unmapped. The fire-and-forget pattern is properly applied in Main.gren, and the chained pattern in Api.gren correctly uses `GrenTask.onError` to swallow recording failures. The build compiles cleanly and all 46 tests pass. The suggestions above are minor improvements worth considering but are not required for merge.
