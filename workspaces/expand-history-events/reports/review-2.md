# Code Review Report

## Summary

The implementation correctly stores actual question and answer content in the `planning_questions_returned` and `answers_submitted` history events. The `requestSubmitAnswers` return type is cleanly extended to pass `questions` and `answers` arrays through to the message handler, and the `countAnswersInPrompt` helper is removed in favor of the more reliable direct array data. The build compiles and all 46 tests pass. One duplication issue is noted as a suggestion; no blocking issues found.

## Issues Found

### BLOCKING Issues

None.

### Suggestions

#### Suggestion 1: Duplicated indexed-dict-building pattern across three sites
- **File:** `packages/chorus/src/Main.gren`
- **Line:** 871-879, 943-951, 953-961
- **Category:** Duplication
- **Description:** The pattern for converting an `Array String` into a `Dict String String` with numbered keys (e.g., `question_1`, `answer_1`) is repeated three times: once in the `QuestionsResult` branch for building `questionsDict`, and twice in the `GotAnswersSubmitted` handler for building `questionsDict` and `answersDict`. All three use the identical `Array.indexedMap` + `Array.foldl` approach with only the key prefix differing.
- **Suggestion:** Extract a helper function like `indexedArrayToDict : String -> Array String -> Dict String String` that takes a prefix string and an array, and returns the numbered dict. For example:
  ```gren
  indexedArrayToDict prefix items =
      items
          |> Array.indexedMap (\i v -> { key = prefix ++ String.fromInt (i + 1), value = v })
          |> Array.foldl (\entry d -> Dict.set entry.key entry.value d) Dict.empty
  ```
  Each call site would become `indexedArrayToDict "question_" questions` or `indexedArrayToDict "answer_" answers`.

#### Suggestion 2: Inconsistent qualification of TaskStatus constructors in Api.gren (carried forward from review-1)
- **File:** `packages/chorus/src/Web/Api.gren`
- **Line:** 509-513 vs 358-360 and 406-410
- **Category:** Style
- **Description:** In `requestSubmitAnswers`, the status constructors `AwaitingInput` and `Planning` are used unqualified (lines 512-513), while the same constructors are fully qualified as `Types.Planning`, `Types.ReadyToStart`, and `Types.AwaitingInput` in `requestApplyPlan` (lines 359-360) and `requestSetQuestions` (lines 408-409). This inconsistency was noted in review-1 and persists in this iteration.
- **Suggestion:** Qualify the constructors in `requestSubmitAnswers` as `Types.AwaitingInput` and `Types.Planning` for consistency with the other two functions.

## Overall Assessment

**Decision:** APPROVED

The changes correctly address the iteration-2 request: both `planning_questions_returned` and `answers_submitted` events now store the actual content of questions and answers as individually keyed entries (`question_1`, `answer_1`, etc.) alongside the existing count fields. The approach of threading `questions` and `answers` arrays through the message type and the `requestSubmitAnswers` return record is clean and avoids the fragile string-parsing approach that was previously used for counting. The removal of `countAnswersInPrompt` also resolves the correctness concern raised in review-1 about potential overcounting of "Q: " lines. Both suggestions above are minor improvements that do not block merge.
