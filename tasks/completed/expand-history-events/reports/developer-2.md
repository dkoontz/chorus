# Developer Report

## Task
Store the actual content of questions and answers in history events, not just counts. The `planning_questions_returned` event now stores each question as `question_1`, `question_2`, etc., and the `answers_submitted` event now stores both questions and answers as `question_1`/`answer_1`, `question_2`/`answer_2`, etc.

## Files Modified
- `packages/chorus/src/Main.gren` - Updated `planning_questions_returned` event in `QuestionsResult` branch to store individual questions as `question_1`, `question_2`, etc. in the event data dict alongside the existing `questionCount`. Updated `GotAnswersSubmitted` message type to include `questions : Array String` and `answers : Array String` fields. Updated the `GotAnswersSubmitted` handler to build the `answers_submitted` event data with individual `question_N` and `answer_N` keys alongside the existing `answerCount`. Removed the now-unused `countAnswersInPrompt` helper function.
- `packages/chorus/src/Web/Api.gren` - Updated `requestSubmitAnswers` return type from `{ apiResult, enrichedPrompt }` to `{ apiResult, enrichedPrompt, questions, answers }`. Added `questionStrings` extraction from `currentQuestions` (mapping `.question` from `PlanningQuestion` records). Passes the original `answers` parameter and extracted `questionStrings` through to the callback result.

## Build Status
**Status:** PASS

All three packages compiled successfully:
- chorus-ui: 9 modules compiled
- tools: all tool binaries built
- chorus: 21 modules compiled

## Test Status
**Status:** PASS

- Unit tests: 27 passed, 0 failed
- Integration tests: 19 passed, 0 failed

## Implementation Notes
- For `planning_questions_returned`: The `questions` variable in the `QuestionsResult questions` branch is an `Array String`, so individual questions are stored directly using 1-based indexing (`question_1`, `question_2`, etc.) via `Array.indexedMap` and `Array.foldl` into a Dict.
- For `answers_submitted`: The answers array was not previously available in `GotAnswersSubmitted` (only `enrichedPrompt` was passed through). Modified `requestSubmitAnswers` in `Api.gren` to return the `answers` parameter and the question strings extracted from the task's `PlanningQuestion` records. These are threaded through the `GotAnswersSubmitted` message type to the handler, where they are stored as `question_N`/`answer_N` pairs.
- The `countAnswersInPrompt` helper was removed since answer count is now derived directly from `Array.length answers` rather than parsing the enriched prompt string. This also addresses the review suggestion from iteration 1 about potential overcounting of "Q: " lines.
- Existing `questionCount` and `answerCount` keys are preserved in both events as requested.
- In the error paths of `requestSubmitAnswers` (task not found, registry error), empty arrays are returned for `questions` and `answers`, which is correct since no Q&A data is available in those cases.
- The destructuring pattern `answers = returnedAnswers` is used in the `SubmitAnswers` route handler to avoid shadowing the `answers` binding from `parseSubmitAnswersBody`.

## Iteration
2
