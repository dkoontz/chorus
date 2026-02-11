# QA Report

## Summary
The provider configuration feature (iteration 2) addresses the two blocking issues from review-1 and implements all suggested improvements. Build and all 67 tests pass. API-level testing confirms CRUD operations, provider validation, agent-provider relationship management, and handoff rejection all work correctly. The browser extension was unavailable for UI testing, so UI verification was limited to code review.

## Test Scenarios

### Scenario 1: List providers (empty registry)
- **Description:** GET /api/providers when no providers exist
- **Steps:**
  1. Start the application with a fresh data directory
  2. GET /api/providers
- **Expected:** Empty array in data field
- **Actual:** `{"data":[],"meta":{"timestamp":...}}`
- **Status:** PASS

### Scenario 2: Create claude-code provider
- **Description:** POST /api/providers with claude-code type
- **Steps:**
  1. POST /api/providers with `{"name":"test-claude","providerType":{"type":"claude-code"}}`
- **Expected:** 201 with created provider config
- **Actual:** Provider created and returned correctly
- **Status:** PASS

### Scenario 3: Create openai-compat provider
- **Description:** POST /api/providers with openai-compat type including all fields
- **Steps:**
  1. POST /api/providers with full openai-compat config (apiBaseUrl, apiKey, defaultModel)
- **Expected:** 201 with created provider config including all API fields
- **Actual:** Provider created with all fields preserved
- **Status:** PASS

### Scenario 4: Create opencode provider
- **Description:** POST /api/providers with opencode type
- **Steps:**
  1. POST /api/providers with `{"name":"test-opencode","providerType":{"type":"opencode"}}`
- **Expected:** 201 with created provider
- **Actual:** Provider created correctly
- **Status:** PASS

### Scenario 5: List providers (populated registry)
- **Description:** GET /api/providers after creating multiple providers
- **Steps:**
  1. Create multiple providers (claude-code, openai-compat, opencode)
  2. GET /api/providers
- **Expected:** Array containing all created providers
- **Actual:** All providers returned with correct types and fields
- **Status:** PASS

### Scenario 6: Get single provider
- **Description:** GET /api/providers/:name for existing provider
- **Steps:**
  1. GET /api/providers/test-claude
- **Expected:** Single provider config returned
- **Actual:** Correct provider returned
- **Status:** PASS

### Scenario 7: Get nonexistent provider (404)
- **Description:** GET /api/providers/:name for nonexistent provider
- **Steps:**
  1. GET /api/providers/nonexistent
- **Expected:** 404 error response
- **Actual:** `{"error":{"code":"NOT_FOUND","message":"Provider not found: nonexistent"}}`
- **Status:** PASS

### Scenario 8: Duplicate provider name (409)
- **Description:** POST /api/providers with duplicate name
- **Steps:**
  1. Create provider "test-claude"
  2. POST /api/providers again with same name
- **Expected:** 409 Conflict error
- **Actual:** `{"error":{"code":"CONFLICT","message":"Provider already exists: test-claude"}}`
- **Status:** PASS

### Scenario 9: Update provider type
- **Description:** PUT /api/providers/:name to change provider type
- **Steps:**
  1. PUT /api/providers/test-claude with `{"providerType":{"type":"opencode"}}`
- **Expected:** 200 with updated provider
- **Actual:** Provider type changed from claude-code to opencode
- **Status:** PASS

### Scenario 10: Delete nonexistent provider (404)
- **Description:** DELETE /api/providers/:name for nonexistent provider
- **Steps:**
  1. DELETE /api/providers/nonexistent
- **Expected:** 404 error
- **Actual:** HTTP 404, `{"error":{"code":"REGISTRY_ERROR","message":"Provider not found: nonexistent"}}`
- **Status:** PASS

### Scenario 11: Invalid provider type rejected
- **Description:** POST /api/providers with unknown provider type
- **Steps:**
  1. POST /api/providers with `{"name":"test","providerType":{"type":"unknown-type"}}`
- **Expected:** 400 Bad Request
- **Actual:** `{"error":{"code":"BAD_REQUEST","message":"Invalid JSON body for provider config"}}`
- **Status:** PASS

### Scenario 12: Agent isValid field - NotConfigured agents
- **Description:** GET /api/agents returns isValid:false for agents with NotConfigured provider
- **Steps:**
  1. GET /api/agents (all seeded agents start with NotConfigured)
- **Expected:** All user-defined agents have isValid:false
- **Actual:** All 6 user-defined agents show `"isValid":false`, task-validator (internal) shows `"isValid":true`
- **Status:** PASS

### Scenario 13: Agent isValid field - valid provider reference
- **Description:** Agent with valid provider reference shows isValid:true
- **Steps:**
  1. Assign writer agent to existing provider "my-openrouter"
  2. GET /api/agents
- **Expected:** writer agent shows isValid:true
- **Actual:** `{"name":"writer","provider":"my-openrouter","isValid":true}`
- **Status:** PASS

### Scenario 14: Delete provider sets affected agents to NotConfigured
- **Description:** DELETE /api/providers/:name updates affected agents and returns their names
- **Steps:**
  1. Assign writer to "test-claude" provider
  2. DELETE /api/providers/test-claude
  3. GET /api/agents (check writer)
- **Expected:** Response includes affectedAgents list; writer becomes NotConfigured
- **Actual:** Response: `{"deleted":"test-claude","affectedAgents":["writer"]}`. Writer now shows `"provider":"not-configured","isValid":false`
- **Status:** PASS

### Scenario 15: Handoff rejected for NotConfigured agent
- **Description:** POST /api/tasks/:id/handoff rejects agent with no provider
- **Steps:**
  1. Create a task
  2. POST handoff with agent "writer" (provider: NotConfigured)
- **Expected:** HTTP 400 with descriptive error
- **Actual:** `{"error":{"code":"BAD_REQUEST","message":"Agent registry error: File system error: Agent 'writer' has no provider configured"}}`
- **Status:** PASS

### Scenario 16: Handoff rejected for nonexistent provider reference
- **Description:** POST /api/tasks/:id/handoff rejects agent referencing missing provider
- **Steps:**
  1. Update writer to reference "nonexistent-provider"
  2. POST handoff for writer
- **Expected:** HTTP 400 with error naming the missing provider
- **Actual:** `{"error":{"code":"BAD_REQUEST","message":"Agent registry error: File system error: Agent 'writer' references provider 'nonexistent-provider' which does not exist"}}`
- **Status:** PASS

### Scenario 17: OpenAI-compat provider handoff produces descriptive error
- **Description:** Handoff with OpenAI-compatible provider fails with clear message
- **Steps:**
  1. Assign writer to "my-openrouter" (openai-compat type)
  2. POST handoff for writer
- **Expected:** Handoff starts but agent spawn fails with descriptive error
- **Actual:** Task transitions through handoff recording, then agent fails with: "Provider 'my-openrouter' is an OpenAI-compatible API provider. API-based agent execution through handoff is not yet implemented."
- **Status:** PASS

### Scenario 18: Provider persists to disk as JSON file
- **Description:** Created providers are stored as individual JSON files in data/providers/
- **Steps:**
  1. Create provider "my-openrouter"
  2. Check filesystem for corresponding .json file
- **Expected:** File data/providers/my-openrouter.json exists with correct content
- **Actual:** File found at dist/data/providers/my-openrouter.json with correct JSON structure
- **Status:** PASS

### Scenario 19: Config cleanup - removed environment variables
- **Description:** CHORUS_API_BASE_URL, CHORUS_API_KEY, CHORUS_DEFAULT_MODEL removed from Config
- **Steps:**
  1. Review Config.gren for old env var references
- **Expected:** None of the three removed env vars present
- **Actual:** Config type and configFromEnv have no API_BASE_URL, API_KEY, or DEFAULT_MODEL fields. providersRoot field added.
- **Status:** PASS

### Scenario 20: Seed defaults use NotConfigured
- **Description:** Agent.Registry seed defaults set provider to NotConfigured
- **Steps:**
  1. Review seedDefaults in Agent.Registry
- **Expected:** All user-defined agents seeded with `provider = NotConfigured`
- **Actual:** All 6 user-defined agents in seedDefaults use `provider = NotConfigured`
- **Status:** PASS

### Scenario 21: Provider/OpenAiCompat renamed to OpenAiCompatible
- **Description:** Module renamed from OpenAiCompat to OpenAiCompatible
- **Steps:**
  1. Check filesystem for Provider/OpenAiCompatible.gren
  2. Verify Provider/OpenAiCompat.gren is deleted
  3. Verify module declaration matches filename
- **Expected:** New file exists with correct module name; old file removed
- **Actual:** Provider/OpenAiCompatible.gren exists with `module Provider.OpenAiCompatible`, old file deleted
- **Status:** PASS

### Scenario 22: Build succeeds
- **Description:** npm run build:all completes without errors
- **Steps:**
  1. Run npm run build:all
- **Expected:** All 23 backend modules, 10 UI modules, and all tools compile successfully
- **Actual:** All compiled successfully, dist assembled
- **Status:** PASS

### Scenario 23: All tests pass
- **Description:** npm run test passes all unit and integration tests
- **Steps:**
  1. Run npm run test
- **Expected:** All tests pass
- **Actual:** 48 unit tests passed, 19 integration tests passed, 0 failures
- **Status:** PASS

## Failures

### Failure 1: Empty provider name accepted by API
- **Scenario:** Edge case - POST /api/providers with empty name
- **Reproduction Steps:**
  1. POST /api/providers with `{"name":"","providerType":{"type":"claude-code"}}`
  2. Observe 201 success response
  3. Provider stored as `.json` file in providers directory
  4. Cannot be deleted via DELETE /api/providers/ (route not matched)
- **Expected Behavior:** API should reject empty provider names with 400 Bad Request
- **Actual Behavior:** Provider created with empty name, persisted as `.json` file, cannot be deleted via API
- **Severity:** MINOR

  Note: The UI already validates against empty names client-side. This is only exploitable via direct API calls.

## Test Code Quality Issues

### Issue 1: No unit tests for ProviderType encode/decode round-trip
- **File:** `packages/chorus/tests/unit/RegistryTests.gren`
- **Problem:** There are no tests for `ProviderType` (OpenAiCompatible, ClaudeCode, OpenCode) encode/decode, `ProviderConfig` encode/decode, or `AgentProvider` with `NotConfigured` value. The existing agent tests only cover `ProviderRef` variants.
- **Suggestion:** Add tests for:
  - `ProviderType` round-trip for each variant (OpenAiCompatible with fields, ClaudeCode, OpenCode)
  - `ProviderConfig` round-trip
  - `AgentProvider` with `NotConfigured` round-trip
  - Unknown provider type string fails to decode

### Issue 2: No integration tests for Provider.Registry
- **File:** `packages/chorus/tests/integration/IntegrationRunner.gren`
- **Problem:** The integration test runner only covers Task.Registry file I/O operations. Provider.Registry has similar file-based CRUD operations (init, getProvider, listProviders, updateProvider, deleteProvider) that are not covered by integration tests.
- **Suggestion:** Add integration tests for Provider.Registry covering:
  - Creating a provider and reading it back
  - Listing providers
  - Updating a provider
  - Deleting a provider
  - Getting a nonexistent provider (ProviderNotFound error)

## Integration Tests Added

No integration tests were added during this QA cycle. The existing test infrastructure (packages/tools/tests/integration/) is designed for tool-level JSON scenario tests, not for backend API or registry-level testing. The Gren integration test runner (`IntegrationRunner.gren`) would need to be extended to cover Provider.Registry operations, which is outside the scope of this QA review.

| Test Name | File | Validates |
|-----------|------|-----------|
| N/A | N/A | No tool-level tests applicable for provider configuration feature |

## Overall Assessment

**Decision:** PASS

All core functionality works as specified:
- Provider CRUD API endpoints function correctly with proper error handling
- Provider types (OpenAiCompatible, ClaudeCode, OpenCode) are correctly encoded/decoded
- DELETE /api/providers/:name properly sets affected agents to NotConfigured and returns affected agent list
- makeProvider reads from provider registry instead of hardcoded string matching
- Agent validation (isValid field) correctly computed from provider existence
- Handoff start correctly rejects agents with NotConfigured or nonexistent providers
- Presets for openai-compat providers have correct base URLs (verified in code: OpenRouter, Ollama, LM Studio)
- Provider delete confirmation dialog implemented in UI code (verified by code review)
- Agent form provider dropdown dynamically populated from provider list (verified by code review)
- Config cleaned up (removed CHORUS_API_BASE_URL, CHORUS_API_KEY, CHORUS_DEFAULT_MODEL)
- Build succeeds and all 67 tests pass

Non-blocking observations:
- Empty provider names are accepted by the API (UI validates client-side, MINOR severity)
- No unit tests for ProviderType/ProviderConfig/AgentProvider(NotConfigured) encode/decode
- No integration tests for Provider.Registry file I/O operations
- Browser-based UI testing was not possible (Chrome extension unavailable); UI functionality was verified through code review only
