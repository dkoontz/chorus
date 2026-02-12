# Merge Agent-Executor into Chorus

## Summary

Consolidate the standalone agent-executor application into the main Chorus application as an internal module. This eliminates the need for a separate binary and allows Chorus to directly execute agents within its process.

## Requirements

- Move agent-executor Gren modules (`Agent/Executor.gren`, `Agent/Spec.gren`, `Provider.gren`, `Provider/ClaudeCode.gren`) into `src/chorus/src/`
- Add ChildProcess permission to Chorus's initialization (needed for Claude Code CLI and file-tools)
- Create an Agent execution API within Chorus that can run agents in response to task state changes
- Update build scripts to remove separate agent-executor build step
- Update Dockerfile to remove agent-executor.js artifact
- Maintain all existing agent-executor tests by migrating them to Chorus test suite

## Acceptance Criteria

- [ ] Agent modules exist under `src/chorus/src/Agent/` with appropriate namespace adjustments
- [ ] Provider modules exist under `src/chorus/src/Provider/`
- [ ] Chorus application initializes with ChildProcess permission
- [ ] Agent.Spec can be parsed from agent markdown files
- [ ] Provider.ClaudeCode can spawn the claude CLI and communicate with it
- [ ] All existing SpecTests pass when run from Chorus test suite
- [ ] `npm run build:app` successfully builds Chorus with integrated agent-executor
- [ ] `npm run build:docker` produces working Docker image without separate agent-executor.js
- [ ] No regression in existing Chorus functionality (web server, API, task registry)

## Out of Scope

- Adding new API endpoints to trigger agent execution (future task)
- Implementing automatic agent scheduling based on task queue (future task)
- Adding new agent types or providers beyond ClaudeCode
- Changes to the web UI

## Technical Context

### Files to Create

- `src/chorus/src/Agent/Executor.gren` - Core executor logic (from agent-executor)
- `src/chorus/src/Agent/Spec.gren` - Agent spec parser (from agent-executor)
- `src/chorus/src/Provider.gren` - Provider interface (from agent-executor)
- `src/chorus/src/Provider/ClaudeCode.gren` - Claude Code implementation (from agent-executor)

### Files to Modify

- `src/chorus/src/Main.gren` - Add ChildProcess initialization
- `src/chorus/gren.json` - Verify dependencies (should be same)
- `src/chorus/tests/unit/TestRunner.gren` - Add SpecTests to test suite
- `package.json` - Remove `build:agent-executor` script, update `build:app`
- `Dockerfile` - Remove agent-executor build steps and artifact copy

### Files to Delete

- `src/agent-executor/` - Entire directory after successful migration

### Related Files (reference only)

- `src/agent-executor/src/Main.gren` - CLI entry point (contains parameter handling that becomes internal)
- `agents/*.md` - Agent specification files (format unchanged)
- `src/tools/` - File tools binary (still needed, unchanged)

### Patterns to Follow

- Follow existing Chorus module organization (see `src/chorus/src/Web/` for sub-module pattern)
- Use Chorus's existing `Logging` module for debug output instead of separate stdout
- Follow Chorus's existing Task-based async patterns

## Testing Requirements

- Migrate `src/agent-executor/tests/unit/SpecTests.gren` to Chorus test suite
- Verify all SpecTests pass: `npm run test:unit`
- Manual verification: Build and run Docker container, verify web UI still works
- Integration test: Create a task and verify the agent modules can parse agent specs

## Notes

- The agent-executor's Main.gren CLI logic becomes unnecessary since execution will be triggered internally
- The executor was designed with a Provider abstraction to support future LLM backends
- The executor handles tool execution through file-tools binary which is still needed
- ChildProcess permission is required for both Claude Code CLI and file-tools binary
- This merge is a structural change; actual API integration for triggering agents is a follow-up task
- The existing module structure in agent-executor (`Agent.Executor`, `Agent.Spec`) maps cleanly to Chorus conventions

## Migration Strategy

1. Copy modules from `src/agent-executor/src/` to `src/chorus/src/`
2. Adjust imports if needed (modules should be self-contained)
3. Add ChildProcess to Chorus initialization
4. Copy and adapt tests
5. Update build scripts
6. Update Dockerfile
7. Verify builds and tests pass
8. Remove old agent-executor directory

## Open Questions

The following may need clarification before implementation:

1. Should the Agent modules be exposed through the Chorus API immediately, or is this purely an internal refactor?
   - Assumption: Internal refactor only; API exposure is a follow-up task

2. Should we keep a CLI interface for running agents standalone (for debugging)?
   - Assumption: No; Docker-only execution policy applies

3. How should agent execution errors be logged/reported?
   - Assumption: Use Chorus's existing Logging module
