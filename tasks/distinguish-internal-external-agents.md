# Distinguish Internal vs External Agents

## Summary
Add an `internal` boolean field to `AgentConfig` to distinguish system-internal agents from user-configured agents. Rename the internal `_planner` agent to `task-validator` to avoid confusion with any user-created planner agent. Update the UI to hide internal agents from the agent selection dropdown and the Agents management page. Add a server-side guard to reject handoff requests that reference internal agents.

## Requirements
- Add an `internal` boolean field to `AgentConfig` in `packages/shared/Types.gren`
- Update `encodeAgentConfig` and `agentConfigDecoder` for the new field
- Rename the internal `_planner` agent to `task-validator`
- Mark `task-validator` as `internal = True` in seed defaults; all others `internal = False`
- Update all references to `_planner` (agent ID, system prompt, seed config) to use `task-validator`
- Filter internal agents from the task detail agent selection dropdown
- Filter internal agents from the Agents management page
- Reject `POST /api/tasks/:id/handoff` for internal agents (HTTP 400)
- The app builds and all tests pass

## Success Criteria
- [ ] `AgentConfig` type has `internal : Bool`
- [ ] `encodeAgentConfig` encodes the `internal` field
- [ ] `agentConfigDecoder` decodes the `internal` field
- [ ] `_planner` agent renamed to `task-validator` everywhere
- [ ] `task-validator` seeded with `internal = True`, others with `internal = False`
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

## Files to Modify
- `packages/shared/Types.gren` -- Add `internal` field to `AgentConfig`, update encoder/decoder
- `packages/chorus/src/Agent/Registry.gren` -- Rename `_planner` to `task-validator`, set `internal` on each seed default
- `packages/chorus/src/Main.gren` -- Add guard in `StartHandoff` handler to reject internal agents; update any `_planner` references
- `packages/chorus-ui/src/Main.gren` -- Filter internal agents before passing to views

## Notes
- The `GET /api/agents` endpoint continues to return all agents (including internal) with the `internal` field visible. Filtering is done client-side in the UI.
- The server-side guard on `POST /api/tasks/:id/handoff` is the enforcement point that prevents internal agents from being used for task execution, even if invoked directly via the API.
- Search the full codebase for `_planner` references to ensure nothing is missed in the rename.
- The rename only affects the agent's identity (ID, name, system prompt). The task status that this agent produces (e.g., `planned`) must NOT be changed.
