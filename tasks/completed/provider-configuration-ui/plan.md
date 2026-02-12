# Provider Configuration UI

## Summary
Replace the current single-provider environment variable setup (CHORUS_API_BASE_URL, CHORUS_API_KEY, CHORUS_DEFAULT_MODEL) with a first-class provider configuration system. Providers become named, persistent entities stored as JSON files in `data/providers/`. Each provider is modeled as a custom type (`OpenAiCompatible { ... } | ClaudeCode | OpenCode`) carrying variant-specific configuration. Agents reference providers via an `AgentProvider` type (`NotConfigured | ProviderRef String`). The UI exposes full CRUD for managing providers, and the backend's `makeProvider` function is updated to read config from the provider registry instead of global environment variables.

## Requirements

### Research: OpenAI-Compatible Services
- Before implementing presets, research whether OpenRouter, Ollama, and LM Studio are compatible with the OpenAI Chat Completions API format. Check: do they support `/v1/chat/completions` with the same request/response schema? Do they require any protocol differences (auth headers, special parameters)?
- If they are compatible, implement them as presets of the `openai-compat` provider type. A "preset" pre-fills `apiBaseUrl` and optionally other fields, but is still stored as an `openai-compat` provider.
- Document findings in a comment or doc string in the relevant code.

### Data Model: ProviderType and ProviderConfig
- Define a custom type in `packages/shared/Types.gren` that explicitly represents provider variants:
  ```
  type ProviderType
      = OpenAiCompatible
            { apiBaseUrl : String
            , apiKey : String
            , defaultModel : String
            }
      | ClaudeCode
      | OpenCode
  ```
  - `OpenAiCompatible` carries all API-specific fields directly in the variant.
  - `ClaudeCode` and `OpenCode` are bare constructors with no extra config (CLI-based).
- Define a `ProviderConfig` record:
  ```
  type alias ProviderConfig =
      { name : String
      , providerType : ProviderType
      }
  ```
  - `name` is the unique identifier, used as the filename and reference key.
- For the agent's provider reference, define:
  ```
  type AgentProvider
      = NotConfigured
      | ProviderRef String  -- the provider name
  ```
  - Replace the `provider : String` field on `UserDefinedAgent` with `provider : AgentProvider`.
  - `NotConfigured` is the explicit default for new agents or agents whose provider was deleted.
- Add encoders and decoders for `ProviderType`, `ProviderConfig`, and `AgentProvider`.
  - The JSON encoding for `ProviderType` should use a discriminator field (e.g., `"type": "openai-compat"`, `"type": "claude-code"`, `"type": "opencode"`) with variant-specific fields at the same level.
  - `AgentProvider` encodes as: `"not-configured"` for `NotConfigured`, or the provider name string for `ProviderRef`.
- Per project convention: no backwards compatibility in decoders -- decode exactly what the type requires.

### Storage: Provider Registry
- Create `packages/chorus/src/Provider/Registry.gren` -- a file-based registry for provider configs, analogous to `Agent.Registry`.
- Providers are stored as individual JSON files in `data/providers/{name}.json`.
- Operations: `init`, `getProvider`, `listProviders`, `updateProvider`, `deleteProvider`.
- On first run (empty directory), do NOT seed any defaults. Start with an empty directory.
- `init` creates the `data/providers/` directory if it does not exist.

### API: Provider CRUD Endpoints
- Add new routes in `Web/Router.gren`:
  - `GET /api/providers` -- list all providers
  - `GET /api/providers/:name` -- get a single provider
  - `POST /api/providers` -- create a new provider
  - `PUT /api/providers/:name` -- update an existing provider
  - `DELETE /api/providers/:name` -- delete a provider
- Add corresponding handler functions in `Web/Api.gren`, following the existing agent CRUD pattern.
- `DELETE /api/providers/:name`:
  - Before deleting, scan all agents to find those referencing this provider (where `provider` is `ProviderRef name`).
  - Return the list of affected agents in the response body (so the UI can show them).
  - Set each affected agent's `provider` field to `NotConfigured`.
  - Then delete the provider file.

### Agent-Provider Relationship
- The `provider` field on `UserDefinedAgent` changes from `provider : String` to `provider : AgentProvider`.
- `ProviderRef "my-openrouter"` means the agent uses the provider named "my-openrouter".
- `NotConfigured` means the agent has no provider assigned and cannot be used for tasks.
- Agents can still override the provider's default model via the existing `model : Maybe String` field. If `model` is `Nothing` and the provider is `OpenAiCompatible`, the provider's `defaultModel` is used.

### Backend Wiring: Updated makeProvider
- Rewrite `makeProvider` in `Main.gren` to:
  1. Pattern match the agent's `provider` field: if `NotConfigured`, return `Nothing`. If `ProviderRef name`, look up the provider in the registry.
  2. Read the `ProviderConfig` for that name.
  3. Pattern match on `providerConfig.providerType` to dispatch to the correct provider implementation:
     - `OpenAiCompatible config` → `OpenAiCompatible.provider` with config values, overriding model with agent's `model` field if set
     - `ClaudeCode` → `ClaudeCode.provider`
     - `OpenCode` → `OpenCode.provider`
  4. Return `Nothing` if the provider name is not found or the agent is internal.
- Remove `apiBaseUrl`, `apiKey`, and `defaultModel` from `Config` and `Config.gren`.
- Remove `CHORUS_API_BASE_URL`, `CHORUS_API_KEY`, `CHORUS_DEFAULT_MODEL` from `configFromEnv`.
- The `providerConfig : ClaudeCode.Config` field on Model should remain, as it is used for the task-validator's internal claude-code provider. Alternatively, ensure the task-validator flow reads from its own hardcoded config or from a provider lookup.

### Validation: Server-Side Agent Validity
- When listing available agents (`GET /api/agents`), include a computed `isValid : Bool` field in the JSON response for each user-defined agent. An agent is valid if:
  - Its `provider` is `ProviderRef name` (not `NotConfigured`).
  - A `ProviderConfig` with that name exists in the provider registry.
- When an agent is selected for a task (handoff start), validate that the agent's provider exists. If not, reject with HTTP 400 and a message like: "Agent 'writer' references provider 'my-openrouter' which does not exist."
- When a tool invokes delegation to an agent, perform the same validation.
- Store validation errors on the task as `Failed` status with a descriptive message, which naturally displays in the UI.
- The UI does NOT contain business logic for determining agent validity -- it just reads `isValid` from the API response and displays accordingly.

### UI: Providers Page
- Add a new page `/providers` to the UI (new route: `ProvidersPage`).
- Add "Providers" to the header navigation alongside "Board" and "Agents".
- The providers page has the same layout pattern as the agents page:
  - List of provider cards showing name, type, base URL (masked API key), and default model.
  - "New Provider" button opens a create/edit modal.
  - Each card has Edit and Delete buttons.
- Provider form modal fields:
  - Name (text input, disabled when editing)
  - Provider Type (dropdown: "OpenAI Compatible", "Claude Code (CLI)", "OpenCode (CLI)")
  - Preset (dropdown, only visible when provider type is "openai-compat"; options like "Custom", "OpenRouter", "Ollama", "LM Studio" -- each pre-fills apiBaseUrl)
  - API Base URL (text input; pre-filled by preset but editable)
  - API Key (password input; show/hide toggle)
  - Default Model (text input)
- When provider type is a CLI type ("claude-code" or "opencode"), hide the API Base URL and API Key fields (they are not applicable).
- Delete confirmation: show a warning listing agents that use this provider, then allow deletion.

### UI: Agent Form Updates
- Replace the hardcoded provider dropdown in the agent create/edit form with a dynamic dropdown populated from `GET /api/providers`.
- Options should be the names of all configured providers, plus a "(Not Configured)" option that maps to `NotConfigured`.
- Display the provider's type and default model next to each option or as help text below the dropdown.

### Cleanup: Remove Replaced Environment Variables
- Remove `CHORUS_API_BASE_URL`, `CHORUS_API_KEY`, `CHORUS_DEFAULT_MODEL` from:
  - `Config.gren` (the `Config` type alias and `configFromEnv`)
  - `.env` file (if present)
  - Any documentation references
- The `CHORUS_LOG_LEVEL` and other non-provider env vars remain unchanged.

## Acceptance Criteria
- [ ] Research on OpenRouter, Ollama, LM Studio OpenAI compatibility is documented in code
- [ ] `ProviderType` custom type defined with `OpenAiCompatible { ... } | ClaudeCode | OpenCode` variants
- [ ] `ProviderConfig` type defined in `packages/shared/Types.gren` with encoder and decoder
- [ ] `AgentProvider` custom type defined with `NotConfigured | ProviderRef String` variants
- [ ] `Provider.Registry` module created with init, CRUD operations, and file-based storage in `data/providers/`
- [ ] Provider CRUD API endpoints added: GET/POST /api/providers, GET/PUT/DELETE /api/providers/:name
- [ ] DELETE /api/providers/:name sets affected agents' provider to `NotConfigured` and returns affected agent list
- [ ] `makeProvider` in Main.gren reads from provider registry instead of hardcoded string matching
- [ ] Agent validation: agents with `NotConfigured` provider are flagged with `isValid: false` in API response
- [ ] Handoff start rejects agents whose provider does not exist (HTTP 400)
- [ ] UI has a /providers page with CRUD for provider configs
- [ ] "Providers" appears in header navigation
- [ ] Provider form shows/hides fields based on provider type (CLI vs API)
- [ ] Presets for openai-compat providers pre-fill apiBaseUrl
- [ ] Agent form's provider dropdown is dynamically populated from provider list
- [ ] Provider delete shows warning with list of affected agents
- [ ] `CHORUS_API_BASE_URL`, `CHORUS_API_KEY`, `CHORUS_DEFAULT_MODEL` removed from Config
- [ ] `Provider/OpenAiCompat.gren` renamed to `Provider/OpenAiCompatible.gren` with all imports updated
- [ ] `npm run build:all` succeeds
- [ ] `npm run test` passes
- [ ] Existing agent JSON files with old provider strings will fail to decode (by design -- no backwards compat); seed defaults updated to use `NotConfigured`

## Out of Scope
- Model polling / listing available models from a provider (future feature)
- Provider health checks or connection testing from the UI
- API key encryption at rest (keys are stored in plaintext JSON, same as current .env approach)
- Provider-specific advanced settings (temperature, max tokens, etc.)
- Migration script for existing agent data -- since there is no backwards compatibility, the existing seed-and-reseed mechanism handles schema changes

## Technical Context

### Files to Create
- `packages/chorus/src/Provider/Registry.gren` -- Provider config file-based registry (modeled on Agent.Registry)

### Files to Modify
- `packages/shared/Types.gren` -- Add ProviderType, ProviderConfig, AgentProvider types with encoders and decoders; change UserDefinedAgent's provider field from String to AgentProvider
- `packages/chorus/src/Config.gren` -- Remove apiBaseUrl, apiKey, defaultModel fields
- `packages/chorus/src/Main.gren` -- Rewrite makeProvider to use provider registry; add provider registry to Model; wire up provider API routes; handle provider init
- `packages/chorus/src/Web/Router.gren` -- Add provider CRUD routes
- `packages/chorus/src/Web/Api.gren` -- Add provider CRUD handlers; add isValid field to agent list response
- `packages/chorus/src/Agent/Registry.gren` -- Update seedDefaults so default agents use `NotConfigured` for their provider
- `packages/chorus-ui/src/Main.gren` -- Add ProvidersPage route, provider list/form state, provider API calls, update agent form to use dynamic provider dropdown
- `packages/chorus-ui/src/View/Agents.gren` -- Update agent form: replace hardcoded provider dropdown with dynamic one; show isValid indicator on agent cards

### New UI Files to Create
- `packages/chorus-ui/src/View/Providers.gren` -- Provider list and form views (modeled on View/Agents.gren)

### Related Files (reference only)
- `packages/chorus/src/Provider.gren` -- Provider interface definition (unchanged)
- `packages/chorus/src/Provider/OpenAiCompat.gren` -- Rename to `Provider/OpenAiCompatible.gren`; update all imports and references
- `packages/chorus/src/Provider/ClaudeCode.gren` -- CLI provider implementation (unchanged)
- `packages/chorus/src/Provider/OpenCode.gren` -- CLI provider implementation (unchanged)
- `packages/chorus/src/Web/Server.gren` -- HTTP server setup (may need minor changes for new routes)

### Patterns to Follow
- File-based registry pattern: see `packages/chorus/src/Agent/Registry.gren` for the exact pattern of init/CRUD/JSON file storage
- API handler pattern: see agent CRUD in `packages/chorus/src/Web/Api.gren` (requestAgents, requestAgent, requestCreateAgent, etc.)
- Route pattern: see `packages/chorus/src/Web/Router.gren` agent routes
- UI page pattern: see `packages/chorus-ui/src/View/Agents.gren` for modal form, card list, Props type pattern
- Shared types pattern: see `packages/shared/Types.gren` AgentConfig for encoder/decoder pair with discriminator field
- Custom type encoding pattern: use a `"type"` discriminator field in JSON (e.g., `{"type": "openai-compat", "apiBaseUrl": "...", ...}`) and decode by matching on that field first
- No backwards compatibility in decoders -- decode exactly what the types require, no defaults or fallbacks

## Testing Requirements
- Build succeeds: `npm run build:all`
- All tests pass: `npm run test`
- Manual test: create a provider via UI, verify it appears in the list and persists in `data/providers/`
- Manual test: create an agent that references the new provider, verify it shows in the agent list with the correct provider name
- Manual test: delete a provider, verify agents that used it show "Not Configured"
- Manual test: attempt to start a task with an agent whose provider is missing, verify it fails with a descriptive error

## Notes
- The seed defaults in `Agent.Registry` currently set all user-defined agents' provider to `"claude-code"`. Since no providers are seeded, these agents will start with `isValid = false` after this change. This is intentional -- users must configure providers before agents can run. Update the seed defaults to set provider to `NotConfigured`.
- The task-validator (internal agent) does not go through `makeProvider` -- it has its own execution path in Main.gren that directly spawns claude-code. This path must continue to work without a provider config.
- The `providerConfig : ClaudeCode.Config` field on Model is specifically for the task-validator's claude-code spawning. It should remain or be refactored, but must not depend on the removed env vars for the API provider fields (it uses baseUrl from the server's own address).
- API key display in the UI: when listing providers, mask the API key (e.g., show only last 4 characters: `"...abc1234"`). The full key is only sent when creating/updating. The GET endpoint should still return the full key so the edit form can display it, but consider security implications.
- When implementing presets, use these default base URLs (subject to research findings):
  - OpenRouter: `https://openrouter.ai/api/v1`
  - Ollama: `http://localhost:11434/v1`
  - LM Studio: `http://localhost:1234/v1`
