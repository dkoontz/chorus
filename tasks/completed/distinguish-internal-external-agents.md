# Distinguish Internal vs External Agents

## Summary
Change `AgentConfig` from a type alias (record) to a custom type with two variants: `InternalAgent` and `UserDefinedAgent`. This replaces the `internal : Bool` field approach. Rename the internal `_planner` agent to `task-validator`. Update the UI to hide internal agents from the agent selection dropdown and the Agents management page. Add a server-side guard to reject handoff requests that reference internal agents.

## Requirements
- Change `AgentConfig` in `packages/shared/Types.gren` from a type alias to a custom type:
  ```
  type AgentConfig
      = InternalAgent { name : String, instructions : String }
      | UserDefinedAgent { name : String, instructions : String, allowedTools : Array String, provider : String, model : Maybe String }
  ```
- `InternalAgent` only needs `name` and `instructions` (no provider/model/allowedTools — internal agents are dispatched by the system, not via provider configs)
- `UserDefinedAgent` has all the fields that the current `AgentConfig` record has (minus `internal`)
- Update `encodeAgentConfig` to encode a `"type"` discriminator field (`"internal"` or `"user_defined"`) plus the variant's fields
- Update `agentConfigDecoder` to decode based on the `"type"` discriminator field
- Update the exposing list to expose `AgentConfig(..)` so variants are accessible
- Rename the internal `_planner` agent to `task-validator`
- Seed `task-validator` as `InternalAgent`; all others as `UserDefinedAgent`
- Update all references to `_planner` (agent ID, system prompt, seed config) to use `task-validator`
- Filter internal agents from the task detail agent selection dropdown
- Filter internal agents from the Agents management page
- Reject `POST /api/tasks/:id/handoff` for internal agents (HTTP 400)
- Add helper functions: `agentConfigName : AgentConfig -> String`, `isInternalAgent : AgentConfig -> Bool`
- The app builds and all tests pass

## Success Criteria
- [ ] `AgentConfig` is a custom type with `InternalAgent` and `UserDefinedAgent` variants
- [ ] `InternalAgent` has only `name` and `instructions` fields
- [ ] `UserDefinedAgent` has `name`, `instructions`, `allowedTools`, `provider`, `model` fields
- [ ] `encodeAgentConfig` encodes with a `"type"` discriminator
- [ ] `agentConfigDecoder` decodes based on the `"type"` discriminator
- [ ] `AgentConfig(..)` is exposed so pattern matching works in other modules
- [ ] Helper functions `agentConfigName` and `isInternalAgent` are exposed
- [ ] `_planner` agent renamed to `task-validator` everywhere
- [ ] `task-validator` seeded as `InternalAgent`, others as `UserDefinedAgent`
- [ ] Agent dropdown in task detail only shows external agents
- [ ] Agents page only shows external agents
- [ ] `POST /api/tasks/:id/handoff` rejects internal agents with HTTP 400
- [ ] `npm run build:all` succeeds
- [ ] `npm run test` passes

## Out of Scope
- Restricting internal agent CRUD at the API level
- Changing internal agent dispatch logic beyond the rename

## Context
- `AgentConfig` is defined in `packages/shared/Types.gren`, shared by backend and UI
- Agent filtering should happen in the UI Main module before passing to view components
- The `_planner` agent is the only internal agent currently; it is seeded in `Agent.Registry.seedDefaults`
- Per project convention: no backwards compatibility -- decoders must decode exactly what the types require, no defaults or fallbacks
- The rename from `_planner` to `task-validator` must cover: seed defaults, any hardcoded references to the agent ID, and the system prompt/description
- All code that accesses `AgentConfig` fields will need to use `when...is` pattern matching on the variants, or use the helper functions

## Files to Modify
- `packages/shared/Types.gren` -- Change `AgentConfig` to custom type, update encoder/decoder, add helpers
- `packages/chorus/src/Agent/Registry.gren` -- Rename `_planner` to `task-validator`, use `InternalAgent`/`UserDefinedAgent` constructors
- `packages/chorus/src/Main.gren` -- Update all `AgentConfig` usage to pattern match; add guard for internal agents on handoff; update `_planner` references
- `packages/chorus-ui/src/Main.gren` -- Update all `AgentConfig` usage to pattern match; filter internal agents before passing to views

## Notes
- The `GET /api/agents` endpoint continues to return all agents (including internal) with the `type` discriminator visible. Filtering is done client-side in the UI.
- The server-side guard on `POST /api/tasks/:id/handoff` is the enforcement point that prevents internal agents from being used for task execution, even if invoked directly via the API.
- Search the full codebase for `_planner` references to ensure nothing is missed in the rename.
- The rename only affects the agent's identity (ID, name, system prompt). The task status that this agent produces (e.g., `planned`) must NOT be changed.
- Since `AgentConfig` is no longer a simple record, all field access like `config.name` must change to pattern matching or use the `agentConfigName` helper.
