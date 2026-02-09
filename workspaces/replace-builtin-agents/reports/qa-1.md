# QA Report: Replace Built-in Agents with General-Purpose Writing Workflow

## Summary

All acceptance criteria have been verified and pass. The implementation correctly replaces the software-development-specific agents with 6 general-purpose writing workflow agents, with full inline instructions, working build, passing tests, and correct seeding behavior.

## Acceptance Criteria Verification

### 1. Deleted files
- **Status:** PASS
- `agents/developer.md` - deleted (entire `agents/` directory removed)
- `agents/developer-review.md` - deleted
- `agents/qa.md` - deleted
- `agents/orchestrator.md` - deleted
- `agents/planner.md` - deleted
- `agents/CODING_STANDARDS.md` - deleted
- `agents/QA_STANDARDS.md` - deleted

### 2. seedDefaults registers all 6 agents
- **Status:** PASS
- `packages/chorus/src/Agent/Registry.gren` defines all 6 agents in `seedDefaults`:
  - researcher (line 110)
  - planner (line 115)
  - writer-workflow (line 120)
  - writer (line 125)
  - editor (line 130)
  - fact-checker (line 135)

### 3. Each seed default has full inline instructions
- **Status:** PASS
- Instructions are extracted into named constants (e.g., `researcherInstructions`, `plannerInstructions`, etc.)
- Key sections verified present in each agent's instructions:
  - **researcher** (7/7 key phrases): Parameters, Workflow, Research Guidelines, Report Format, Important section
  - **planner** (7/7 key phrases): Parameters, Workflow, Clarifying Questions, Task File Template, Approval Process, Important section
  - **writer-workflow** (9/9 key phrases): Workflow State Machine, all Phases, Invoking Sub-Agents, Status File Format, Decision Rules, Starting the Workflow, Task File Organization
  - **writer** (7/7 key phrases): Parameters (incl. optional EDITOR_REPORT, FACT_CHECK_REPORT, RESEARCH_REPORT), Revision Guidelines, Report Format, Self-Assessment, Important section
  - **editor** (10/10 key phrases): Review Criteria (all 6 categories), Severity Levels, Report Format with APPROVED | CHANGES REQUESTED
  - **fact-checker** (8/8 key phrases): What to Check (all 4 categories), What NOT to Check, Severity Levels, Report Format with PASS | FAIL

### 4. Module comment updated
- **Status:** PASS
- Line 16: `known agents: researcher, planner, writer-workflow, writer, editor, fact-checker`

### 5. README.md documents both usage patterns
- **Status:** PASS
- "Standalone Agents" section with examples for Researcher and Planner
- "Writing Workflow" section with examples for orchestrated writing process
- Agent table listing all 6 agents with descriptions
- Workflow diagram showing the write -> edit -> fact-check loop
- Individual workflow agent invocation examples for debugging

### 6. Build succeeds
- **Status:** PASS
- `npm run build:all` completed successfully (UI, tools, chorus all compile)

### 7. Tests pass
- **Status:** PASS
- 27 unit tests passed, 0 failed
- 19 integration tests passed, 0 failed
- Test data uses updated agent names (writer, editor, researcher) for consistency

### 8. Seeding verification
- **Status:** PASS
- Deleted `data/agents/` directory
- Started app with `npm run start`
- API response at `GET /api/agents` returns all 6 agents:
  - editor, fact-checker, planner, researcher, writer, writer-workflow
- Each agent has full instructions, `allowedTools: "Bash(file-tools *)"`, `permissionMode: "bypassPermissions"`
- 6 JSON files created on disk in `data/agents/`

## Notes

- The task spec uses `~~~` for code fences inside the instruction markdown (because the specs are nested inside triple-backtick blocks in the task file). The implementation correctly uses standard backtick code fences (```) in the actual instructions, which is semantically equivalent and the correct rendering for standard markdown.
- All `allowedTools` and `permissionMode` values match the expected configuration.
- The instruction strings are stored as separate named constants in Registry.gren (e.g., `researcherInstructions`, `writerWorkflowInstructions`) rather than inline in the array literal, which improves readability.

## Verdict

**PASS** - All acceptance criteria met. No issues found.
