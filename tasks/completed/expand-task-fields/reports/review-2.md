# Code Review Report

## Summary

The developer addressed the review-1 blocking issue by refactoring the flat `Task` type into a `DescriptionOnly | Planned` union type, adding accessor functions, setter functions, and backward-compatible decoders. The implementation is well-structured. There are a few issues worth addressing: one related to correctness around the `parseStatusBody` decoder expecting a string but the frontend sending a nested object, and several suggestions around duplication and naming.

## Issues Found

### BLOCKING Issues

#### Issue 1: parseStatusBody decoder may reject frontend status updates

- **File:** `src/chorus/src/Main.gren`
- **Line:** 490-518
- **Category:** Correctness
- **Description:** `parseStatusBody` decodes `Decode.field "status" Decode.string`, expecting `{"status": "active"}`. However, the frontend `updateTaskStatus` in `src/chorus-ui/src/Api.gren` (lines 308-336) sends `{"status": {"type": "active"}}` -- a nested object with a `type` field, not a plain string. This mismatch means status updates from the frontend would fail with a 400 Bad Request, unless there is middleware transforming the payload.
- **Suggestion:** Either change `parseStatusBody` to decode the nested `{"status": {"type": "..."}}` format that the frontend sends, or change the frontend to send `{"status": "active"}`. One side must match the other. This is a pre-existing issue (not introduced in this iteration), but it should be verified since the refactoring touched the status update flow. If status updates are currently working, this may be handled elsewhere -- but the code as written appears mismatched.

### Suggestions

#### Suggestion 1: Significant duplication across accessor and setter functions

- **File:** `src/chorus/src/Task/Registry.gren`
- **Line:** 186-384
- **Category:** Duplication
- **Description:** There are 9 accessor functions and 4 setter functions, each following the identical pattern of matching on `DescriptionOnly t` and `Planned t` then extracting/updating the same-named field. This is approximately 200 lines of boilerplate. The same pattern is duplicated in `src/chorus-ui/src/Api.gren` (lines 160-245) with another 9 accessor functions.
- **Suggestion:** Consider extracting a helper that unwraps the shared base fields into a common record, reducing the per-accessor boilerplate. For example, a `baseFields : Task -> { id : String, description : String, ... }` function that pattern-matches once, then each accessor just calls `(baseFields task).id`. This would cut the accessor code roughly in half. Alternatively, this may be an acceptable cost of the union type approach in Gren; the duplication is mechanical and unlikely to drift.

#### Suggestion 2: Duplicated decoder logic across backend and frontend

- **File:** `src/chorus-ui/src/Api.gren`
- **Line:** 453-639
- **Category:** Duplication
- **Description:** The three decoders (`descriptionOnlyTaskDecoder`, `plannedTaskDecoder`, `legacyTaskDecoder`) and the `taskDecoder` dispatch logic are nearly identical between the backend `Task.Registry` and the frontend `Api` module. This is roughly 200 lines of duplicated logic.
- **Suggestion:** This is a known limitation of having separate Gren packages for backend and frontend. No immediate action needed, but it is worth noting as a future area where a shared module or code generation could reduce the risk of the two decoders diverging.

#### Suggestion 3: `legacyTaskDecoder` heuristic could misclassify tasks

- **File:** `src/chorus/src/Task/Registry.gren`
- **Line:** 1074-1076
- **Category:** Correctness
- **Description:** The legacy decoder checks if all four planning fields are empty to decide between `DescriptionOnly` and `Planned`. A task serialized with `taskType: "planned"` but with all-empty planning fields (e.g., summary="" and empty arrays) would correctly decode as `Planned` via the `taskType` discriminator. However, if the `taskType` field were somehow stripped, the legacy decoder would misclassify it as `DescriptionOnly`. This is an unlikely edge case since `taskType` is always written by `encodeTask`.
- **Suggestion:** This is acceptable for backward compatibility. The scenario only arises with manually edited JSON files that remove `taskType` but leave empty planning fields. No change needed, but worth documenting in a code comment that the `taskType` discriminator takes precedence and the heuristic is a fallback only for truly legacy data.

#### Suggestion 4: `sectionEquals` in TaskDetail could use a simpler approach

- **File:** `src/chorus-ui/src/View/TaskDetail.gren`
- **Line:** 428-444
- **Category:** Simplification
- **Description:** The `sectionEquals` function uses a record-wrapping pattern to compare two `PlanningSection` values. Since `PlanningSection` has no payload data on any variant, a simpler approach like converting to strings and comparing, or using `==` directly (if Gren supports structural equality on simple union types), would be shorter.
- **Suggestion:** Check if `==` works for `PlanningSection` comparison in Gren. If it does, the entire `sectionEquals` function can be replaced with `a == b`. Similarly, `statusEquals` in `Dashboard.gren` and `Registry.gren` follow this same pattern for `TaskStatus` and could potentially be simplified, though `Failed String` makes `==` behavior worth verifying.

#### Suggestion 5: `taskType` discriminator field name rationale should be in a comment

- **File:** `src/chorus/src/Task/Registry.gren`
- **Line:** 797-799
- **Category:** Style
- **Description:** The developer report explains that `taskType` was chosen over `type` because `type` is already used inside the `status` JSON object. This is a reasonable decision, but the rationale exists only in the dev report, not in the codebase.
- **Suggestion:** Add a brief comment near the `encodeTask` function or the `taskDecoder` explaining why `taskType` is used instead of `type` as the discriminator field name.

#### Suggestion 6: `setUpdatedAt` is exported in module header but not in the exposing list

- **File:** `src/chorus/src/Task/Registry.gren`
- **Line:** 1-38
- **Category:** Style
- **Description:** The `setUpdatedAt` function is defined (line 340) and used internally by `updateTask` (line 640-641), but it is not included in the module's `exposing` list. Meanwhile, `setSessionId` is also not exported but is defined. This is correct -- these are internal helpers. However, `setAttachments` and `setTaskStatus` are exported. The inconsistency in which setters are public vs private is not documented.
- **Suggestion:** Add a comment grouping the internal vs. public setter functions, or add all setters to the exposing list for consistency. Currently the selection seems driven by which setters `Web.Api` needs, which is fine, but a brief note would help future developers understand the decision.

## Overall Assessment

**Decision:** CHANGES REQUESTED

The blocking issue around `parseStatusBody` should be investigated and resolved. If status updates from the frontend are already working in production (meaning the mismatch is handled somewhere not visible in these files), then this can be downgraded to a suggestion with a clarifying comment. Otherwise, it is a functional bug that would cause status updates to fail.

The suggestions are non-blocking improvements around reducing duplication and improving documentation. The union type refactoring itself is well done and follows the "Make Invalid States Unrepresentable" coding standard correctly.
