# Code Review Report

## Summary

The implementation cleanly adds a `GET /api/config/defaults` endpoint, wires it through the router and UI API module, and redesigns the "New Workspace" form with a name input that auto-computes the path. The code follows existing patterns, builds successfully, and all 85 tests pass. One blocking issue found related to the Create button being enabled while a validation error is displayed.

## Issues Found

### BLOCKING Issues

#### Issue 1: Create button enabled while name validation error is showing
- **File:** `packages/chorus-ui/src/View/Workspaces.gren`
- **Line:** 196
- **Category:** Correctness
- **Description:** The "Create" button's `disabled` check only considers whether the path is empty or the app is loading: `disabled (String.isEmpty (String.trim config.createPath) || config.loading)`. It does not account for `nameValidationError`. Consider this scenario: the user types a valid name (path auto-populates), then edits the name to include `/` or `..`. The path still contains the previously computed value, so the button remains enabled. The user can click "Create" and create a workspace whose path was derived from a now-invalid name. While the path itself may be technically valid, allowing submission while a red validation error is visible is confusing and contradicts the acceptance criterion that names with invalid characters "show a validation error and the path is not auto-computed" -- the implication being that the form is in an error state.
- **Suggestion:** Add `config.nameValidationError /= Nothing` to the disabled condition: `disabled (String.isEmpty (String.trim config.createPath) || config.nameValidationError /= Nothing || config.loading)`. Alternatively, clear the path when validation fails (but that changes behavior for users who manually edited the path).

### Suggestions

#### Suggestion 1: Form state not reset after successful workspace creation
- **File:** `packages/chorus-ui/src/Main.gren`
- **Line:** 1547-1555
- **Category:** Correctness
- **Description:** The `CreateConfig` handler sends the create request but never clears the form state on success. After a workspace is created and `GotConfig` fires, `createName`, `createPathManuallyEdited`, and `nameValidationError` retain their values. The pre-existing `createPath` field also was not cleared, so this is a pre-existing pattern, but with more form state now (name, manual-edit flag, validation error), stale state becomes more noticeable if the user navigates back to the Workspaces page.
- **Suggestion:** In the `GotConfig` success handler (around line 1421), reset the create form fields: `createName = ""`, `createPath = ""`, `createPathManuallyEdited = False`, `nameValidationError = Nothing`. This would be a follow-up improvement rather than a strict requirement.

#### Suggestion 2: Validation error persists when name is cleared
- **File:** `packages/chorus-ui/src/Main.gren`
- **Line:** 1490-1498
- **Category:** Correctness
- **Description:** If the user types an invalid name (e.g., "foo/bar"), sees the validation error, and then clears the name field entirely, the validation runs on the empty string. `String.contains "/" ""` returns `False`, so the error clears naturally. This is actually correct behavior. However, if the user types "foo/bar" and then deletes just "bar" to leave "foo/", the validation error remains because `/` is still present. The path is not cleared either (the `validationError /= Nothing` branch preserves the old path). This is correct behavior, but worth noting that the path shown may be stale in this intermediate state.
- **Suggestion:** No code change needed -- this is just a note for awareness. The behavior is reasonable.

#### Suggestion 3: Consider extracting name validation into a helper function
- **File:** `packages/chorus-ui/src/Main.gren`
- **Line:** 1490-1498
- **Category:** Simplification
- **Description:** The name validation logic is inline within the `UpdateCreateName` handler. If name validation is ever needed elsewhere (e.g., server-side), extracting it into a named function like `validateWorkspaceName : String -> Maybe String` would improve reusability and testability.
- **Suggestion:** Extract the validation into a standalone function: `validateWorkspaceName : String -> Maybe String` that returns `Nothing` on success or `Just errorMessage` on failure. This is a minor readability improvement and not required.

## Overall Assessment

**Decision:** CHANGES REQUESTED

The blocking issue is that the Create button remains enabled while a name validation error is displayed, which creates a confusing user experience. The fix is a one-line change to the `disabled` attribute in `viewCreateWorkspace`. Once that is addressed, the implementation looks solid and ready to merge.
