# QA Report

## Summary

All 43 automated tests pass (25 unit, 18 integration) and the full build completes without errors. The implementation matches the task specification. Manual browser testing of the running application was not possible because the Docker image is pinned to `linux/amd64` and the test machine is `darwin/arm64`; the Gren-compiled Node.js application does not start outside Docker. This is a pre-existing infrastructure constraint, not a defect in this feature. Code review of all modified files confirms correctness of the planning fields, API endpoint, frontend editing flow, and CSS styles.

## Test Scenarios

### Scenario 1: Unit tests pass
- **Description:** Run the full unit test suite to verify encode/decode round-trips and backward compatibility
- **Steps:**
  1. Run `npm run test:unit`
- **Expected:** All 25 unit tests pass
- **Actual:** 25 passed, 0 failed
- **Status:** PASS

### Scenario 2: Integration tests pass
- **Description:** Run the integration test suite to verify file I/O operations
- **Steps:**
  1. Run `npm run test:integration`
- **Expected:** All 18 integration tests pass
- **Actual:** 18 passed, 0 failed
- **Status:** PASS

### Scenario 3: Full build succeeds
- **Description:** Build all components (UI, tools, chorus) and verify compilation
- **Steps:**
  1. Run `npm run build:app`
- **Expected:** All modules compile without errors
- **Actual:** chorus-ui compiled 6 modules, chorus compiled 8 modules, tools compiled 4 modules
- **Status:** PASS

### Scenario 4: Docker image builds
- **Description:** Build the Docker image
- **Steps:**
  1. Run `npm run build:docker`
- **Expected:** Image builds without errors
- **Actual:** Image `chorus:latest` built; 2 platform-related warnings (pre-existing)
- **Status:** PASS

### Scenario 5: Planned task encode/decode round-trip (unit test)
- **Description:** Verify that a Planned task with all four planning fields can be encoded to JSON and decoded back identically
- **Steps:**
  1. Test `testTaskEncodeDecodeWithPlanningFields` creates a Planned task with summary, requirements (2 items), acceptanceCriteria (2 items), and plan (3 items)
  2. Encodes to JSON via `Registry.encodeTask`
  3. Decodes via `Registry.taskDecoder`
  4. Asserts the decoded task equals the original
- **Expected:** Round-trip produces identical task
- **Actual:** Test passes
- **Status:** PASS

### Scenario 6: Backward-compatible decoding of legacy JSON (unit test)
- **Description:** Verify that task JSON without taskType or planning fields decodes as DescriptionOnly
- **Steps:**
  1. Test `testTaskDecodeBackwardCompatibility` uses hand-crafted JSON without taskType, summary, requirements, acceptanceCriteria, or plan fields
  2. Decodes via `Registry.taskDecoder`
  3. Asserts the result is DescriptionOnly (not Planned)
- **Expected:** Legacy JSON decodes as DescriptionOnly with empty defaults
- **Actual:** Test passes
- **Status:** PASS

### Scenario 7: Legacy JSON with planning fields decodes as Planned (unit test)
- **Description:** Verify that legacy JSON (no taskType) with non-empty planning fields decodes as Planned
- **Steps:**
  1. Test `testTaskDecodeBackwardCompatWithPlanningFields` uses JSON without taskType but with `summary: "My summary"` and `requirements: ["req1"]`
  2. Decodes via `Registry.taskDecoder`
  3. Asserts the result is Planned with correct field values
- **Expected:** Legacy JSON with planning data decodes as Planned
- **Actual:** Test passes
- **Status:** PASS

### Scenario 8: DescriptionOnly task round-trip (unit test)
- **Description:** Verify DescriptionOnly tasks encode the taskType discriminator and decode correctly
- **Steps:**
  1. Test `testDescriptionOnlyRoundTrip` creates a DescriptionOnly task and verifies encode/decode
- **Expected:** DescriptionOnly task round-trips correctly with `taskType: "descriptionOnly"` discriminator
- **Actual:** Test passes
- **Status:** PASS

### Scenario 9: Code review -- parseStatusBody decoder fix
- **Description:** Verify the parseStatusBody decoder accepts both nested and flat status formats
- **Steps:**
  1. Read `src/chorus/src/Main.gren` lines 495-562
  2. Verify `Decode.oneOf [ nestedDecoder, flatDecoder ]` is used
  3. Verify nested decoder handles `{"status": {"type": "active"}}` format
  4. Verify flat decoder handles `{"status": "active"}` format
  5. Verify `failed` status with optional message is handled in nested decoder
- **Expected:** Both formats are accepted; frontend's nested format is tried first
- **Actual:** Implementation correctly uses `Decode.oneOf` with nested decoder first, flat decoder as fallback. The nested decoder properly handles the `failed` variant with optional `message` field.
- **Status:** PASS

### Scenario 10: Code review -- UpdateTaskPlanning route
- **Description:** Verify the PUT /api/tasks/:id/planning route is properly wired
- **Steps:**
  1. Check `Web.Router.gren` for `UpdateTaskPlanning String` variant and route parsing for `PUT /api/tasks/:id/planning`
  2. Check `Web.Api.gren` for `UpdatePlanningParams` type and `requestUpdatePlanning` handler
  3. Check `Main.gren` for `parseUpdatePlanningBody` and route handling
  4. Verify partial update semantics (Maybe fields, withDefault merging)
- **Expected:** Full route pipeline from parsing to handler to response
- **Actual:** Route parsing at line 75-76, route handling at lines 373-379, body parsing at lines 583-605, API handler at lines 217-273. Partial update uses `Maybe.withDefault currentFields.X params.X` correctly. A DescriptionOnly task is converted to Planned via `Registry.planTask` when planning fields are set.
- **Status:** PASS

### Scenario 11: Code review -- Frontend planning editing flow
- **Description:** Verify the frontend correctly manages planning edit state and sends partial updates
- **Steps:**
  1. Check `Main.gren` for all planning Msg variants and their handlers
  2. Verify `EditPlanningSection` initializes draft state from current task values
  3. Verify `SavePlanning` sends only the section being edited (partial update)
  4. Verify `PlanningUpdated` clears editing state and updates selectedTask
  5. Check `View.TaskDetail.gren` for rendering logic
- **Expected:** Edit state is properly initialized, partial updates send only the relevant field, and UI correctly renders both view and edit modes
- **Actual:** All Msg variants (EditPlanningSection, UpdatePlanningDraft, UpdatePlanningItemDraft, AddPlanningItem, RemovePlanningItem, SavePlanning, CancelPlanningEdit, PlanningUpdated) are properly handled. SavePlanning constructs params with only the relevant field set to Just, all others Nothing. The view correctly renders DescriptionOnly tasks with a "Not yet planned" placeholder and "Add Planning" button, and Planned tasks with all four sections.
- **Status:** PASS

### Scenario 12: Code review -- Frontend Api.updateTaskPlanning
- **Description:** Verify the frontend API function correctly encodes partial updates
- **Steps:**
  1. Check `Api.gren` `updateTaskPlanning` function
  2. Verify it uses `encodeMaybeField` to only include present fields in the JSON body
  3. Verify it sends PUT to the correct URL
- **Expected:** Only non-Nothing fields are included in the JSON payload
- **Actual:** The `encodeMaybeField` helper returns an empty array for Nothing and a single-element array for Just, and `Array.flatten` is used to combine them. This means only present fields appear in the JSON body. URL is correctly `/api/tasks/:id/planning`.
- **Status:** PASS

### Scenario 13: Code review -- CSS styles for planning sections
- **Description:** Verify all required CSS classes are defined for planning sections
- **Steps:**
  1. Check `styles.css` for planning-sections, planning-section, planning-section-header, planning-text, planning-numbered-list, planning-edit, planning-textarea, planning-item-list, planning-item-edit, planning-remove-btn, planning-add-btn, planning-edit-actions, empty-state-text
- **Expected:** All CSS classes referenced in TaskDetail.gren are defined
- **Actual:** All 16 CSS selectors for planning sections are present (lines 724-820). Styles cover the container, section cards, headers, numbered lists, edit mode textareas, item add/remove buttons, save/cancel actions, and empty state placeholders.
- **Status:** PASS

### Scenario 14: Manual runtime testing (Docker)
- **Description:** Start the application in Docker and test the web UI
- **Steps:**
  1. Run `npm run docker:compose`
  2. Navigate to http://localhost:8080
- **Expected:** Application starts and serves the web UI
- **Actual:** Docker container exits immediately because the Docker image is built for `linux/amd64` (hardcoded in Dockerfile) but the host is `darwin/arm64`. The Gren-compiled Node.js application also does not start outside Docker due to the Gren runtime not keeping the Node event loop alive (the runtime depends on the HTTP server subscription to prevent process exit, but the init chain appears to fail silently before the server binds). This is a pre-existing infrastructure limitation, not a defect in this feature.
- **Status:** BLOCKED (pre-existing infrastructure issue)

## Failures

No failures specific to this feature. The inability to run the application locally is a pre-existing infrastructure constraint (Docker amd64-only image on arm64 host).

## Test Code Quality Issues

### Issue 1: testStatusRoundTrip does not verify the full task round-trip
- **File:** `src/chorus/tests/unit/RegistryTests.gren`
- **Line:** 114-148
- **Problem:** The `testStatusRoundTrip` helper only checks `taskStatus` on the decoded task, not the full task equality. If other fields were corrupted during encode/decode, this test would not catch it.
- **Suggestion:** Change the assertion to `expectEqual task decodedTask` instead of only checking the status field. The existing `testTaskEncodeDecode` and `testDescriptionOnlyRoundTrip` tests do check full equality, so this is a minor gap.

### Issue 2: testSourceInfoEncodeDecode uses compound conditional instead of separate assertions
- **File:** `src/chorus/tests/unit/RegistryTests.gren`
- **Line:** 184-187
- **Problem:** The test combines two checks (`sessionId == Just "session-123" && conversationId == Just "thread-456"`) into a single `if` expression with a generic "mismatch" error message. If one field fails, the error message does not indicate which one.
- **Suggestion:** Use two separate `expectEqual` calls chained with `Task.andThen`, similar to how `testAttachmentRoundTrip` verifies fields individually.

### Issue 3: No failure-case test for planning field decoding
- **File:** `src/chorus/tests/unit/RegistryTests.gren`
- **Problem:** There is no test verifying that malformed planning field values (e.g., `requirements` as a string instead of an array) are handled gracefully. The backward-compatible decoders use `Decode.oneOf` with fallback defaults, but this graceful degradation is not exercised by any test.
- **Suggestion:** Add a test with JSON containing `"requirements": "not-an-array"` and verify it falls back to empty array (or the correct decoder is selected).

### Issue 4: No test for parseStatusBody with nested format
- **File:** `src/chorus/tests/unit/RegistryTests.gren` or integration tests
- **Problem:** The key fix in this iteration (parseStatusBody accepting both nested `{"status": {"type": "active"}}` and flat `{"status": "active"}` formats) has no dedicated test. The fix was verified via code review and the fact that all existing tests still pass, but there is no test that specifically exercises the nested decoder path.
- **Suggestion:** This would require an HTTP-level integration test (or a unit test that directly calls the decoder logic), which is not currently part of the test infrastructure. Noted as a gap.

## Integration Tests Added

No integration tests were added to the JSON integration test suite (`src/tools/tests/integration/`) because the QA standards describe integration tests for the file tools, not for the Gren application's API endpoints. The Gren application has its own integration test suite in `src/chorus/tests/integration/IntegrationRunner.gren` which exercises the Registry and Queue modules directly. The existing 18 integration tests all pass.

The task specification's testing requirements for unit tests (encode/decode round-trip, backward compatibility) are covered by the four new unit tests: `testTaskEncodeDecodeWithPlanningFields`, `testTaskDecodeBackwardCompatibility`, `testTaskDecodeBackwardCompatWithPlanningFields`, and `testDescriptionOnlyRoundTrip`.

The manual test requirements (view task detail page, edit/save/refresh planning fields, verify partial updates) could not be executed because the application cannot be run on the test machine (Docker arm64 limitation).

## Overall Assessment

**Decision:** PASS

The implementation satisfies all acceptance criteria that can be verified through automated testing and code review:

- The `Task` type in `Task.Registry` uses a union type (`DescriptionOnly | Planned`) with the four planning fields on the `Planned` variant
- JSON keys are correctly `"summary"`, `"requirements"`, `"acceptanceCriteria"`, and `"plan"`
- Backward-compatible decoding works for legacy JSON (confirmed by unit tests)
- The `PUT /api/tasks/:id/planning` endpoint accepts partial updates via `Maybe` fields
- The task detail page renders planning sections with edit mode (confirmed by code review)
- The frontend `Api.Task` type mirrors the backend with the four new fields
- Unit tests verify encode/decode round-trip and backward compatibility
- All 43 tests pass and `npm run build:app` completes without errors

The blocking `parseStatusBody` fix from this iteration is correct: it uses `Decode.oneOf` to accept both the frontend's nested object format and a flat string format for backward compatibility.

Non-blocking observations:
- Manual browser testing could not be performed due to Docker platform mismatch (pre-existing)
- Four test code quality issues were identified (none blocking)
- The `sectionEquals` wrapper function is trivial (`a == b`) and could be inlined, as noted in review-3
