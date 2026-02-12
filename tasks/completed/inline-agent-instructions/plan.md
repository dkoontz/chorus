# Inline Agent Instructions

## Summary

Replace external file references in agent configs with inline instructions, add a full agent CRUD UI, and remove `workspacePath` from task records (it will be provided at runtime by the Chorus main process).

## Requirements

- [x] Replace `specPath` field with `instructions` field on `AgentConfig` (stores markdown content inline)
- [ ] Backward-compatible decoder: old JSON with `specPath` decodes to empty `instructions`
- [ ] Move `AgentConfig` type, encoder, decoder to shared `Types` module (needed by UI)
- [ ] Update agent seed defaults to use brief placeholder instructions
- [ ] Add `updateAgent` and `deleteAgent` to `Agent.Registry`
- [ ] Remove `Agent.Spec` module (no longer parsing from files)
- [ ] Move `AgentSpec` type alias to `Provider` module
- [ ] Update `Main.gren` to use `agentConfig.instructions` directly (no file read)
- [ ] Compute `workspaceRoot` at agent start time from `config.workspacesRoot + taskId`
- [ ] Add API routes: `POST /api/agents`, `PUT /api/agents/:name`, `DELETE /api/agents/:name`
- [ ] Add API handlers for agent create/update/delete
- [ ] Remove `workspacePath` from `DescriptionOnlyTask` and `PlannedTask`
- [ ] Remove `taskWorkspacePath` accessor and all encoder/decoder references
- [ ] Remove workspace display from `TaskDetail` view
- [ ] Add agent CRUD functions to UI `Api` module
- [ ] Create `View/Agents.gren` with list, create, edit, delete views
- [ ] Add "Agents" nav tab in header alongside "Board"
- [ ] Add `AgentsPage` routing, model state, and update handlers in UI `Main.gren`
- [ ] Update tests: remove `workspacePath` references, delete `SpecTests`, update `TestRunner`

## Acceptance Criteria

- `npm run build:all` compiles successfully
- `npm run test` passes all tests
- `GET /api/agents` returns agents with `instructions` field, no `specPath`
- Agents page accessible via "Agents" nav tab at `/agents`
- Can create a new agent with custom name, instructions, tools, permissions
- Can edit an existing agent's instructions and other fields
- Can delete an agent
- Agent handoff still works (agent executes with inline instructions as system prompt)
- Task detail no longer shows "Workspace" field
- Old agent JSON files with `specPath` are handled gracefully (decoded with empty instructions)

## Architecture

```
AgentConfig (shared Types module)
{ name : String
, instructions : String      -- inline markdown, replaces specPath
, allowedTools : String
, permissionMode : String
}
```

```
Agent Execution Flow (updated):
1. POST /api/tasks/:id/handoff { agentName, prompt }
2. Main.gren looks up AgentConfig from registry
3. Uses agentConfig.instructions directly as systemPrompt (no file read)
4. Computes workspaceRoot = config.workspacesRoot ++ "/" ++ taskId
5. Spawns claude CLI with --system-prompt and --add-dir
```

## Files to Modify

| File | Change |
|------|--------|
| `packages/shared/Types.gren` | Add AgentConfig types; remove workspacePath from tasks |
| `packages/chorus/src/Agent/Registry.gren` | Use shared types; add update/delete; update seeds |
| `packages/chorus/src/Agent/Spec.gren` | **Delete** |
| `packages/chorus/src/Provider.gren` | Define AgentSpec locally |
| `packages/chorus/src/Provider/ClaudeCode.gren` | Update AgentSpec import |
| `packages/chorus/src/Agent/Executor.gren` | Remove Spec dependency |
| `packages/chorus/src/Web/Router.gren` | Add agent CRUD routes |
| `packages/chorus/src/Web/Api.gren` | Add agent CRUD handlers |
| `packages/chorus/src/Main.gren` | Inline instructions; agent routes; runtime workspaceRoot |
| `packages/chorus/src/Task/Registry.gren` | Remove workspacePath from task creation |
| `packages/chorus-ui/src/Api.gren` | Add agent API functions |
| `packages/chorus-ui/src/View/Agents.gren` | **New** - Agent list/edit/create/delete |
| `packages/chorus-ui/src/Main.gren` | Add AgentsPage, nav tab, agent state |
| `packages/chorus-ui/src/View/TaskDetail.gren` | Remove workspace display |
| `packages/chorus/tests/unit/RegistryTests.gren` | Remove workspacePath from tests |
| `packages/chorus/tests/unit/SpecTests.gren` | **Delete** |
| `packages/chorus/tests/unit/TestRunner.gren` | Remove SpecTests |

## Implementation Phases

### Phase 1: Shared Types
Update `packages/shared/Types.gren` - add AgentConfig, remove workspacePath from task types.

### Phase 2: Backend Agent Registry
Update `Agent.Registry` to use shared types, add update/delete, update seed defaults.

### Phase 3: Remove Agent.Spec, Update Provider
Delete `Agent.Spec`, move AgentSpec to Provider, update Executor and ClaudeCode imports.

### Phase 4: Backend Agent CRUD API
Add routes, handlers, and body parsers for agent create/update/delete. Update Main.gren to use inline instructions and compute workspaceRoot at runtime.

### Phase 5: Task Registry
Remove workspacePath from task creation in `Task/Registry.gren`.

### Phase 6: Agent CRUD UI
Add API functions, Agents view, nav tab, routing, and state management to chorus-ui.

### Phase 7: Tests
Update RegistryTests, delete SpecTests, update TestRunner.

## Testing

1. `npm run build:all` - Both chorus and chorus-ui compile
2. `npm run test` - All unit tests pass
3. Manual: Start server, verify Agents tab works, create/edit/delete agents
4. Manual: Verify agent handoff still executes correctly
5. `curl /api/agents` - Confirm JSON structure has `instructions`, no `specPath`
