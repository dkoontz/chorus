# Pre-approved Agent Permissions

## Summary

Create utility scripts and configure permission allowlists so that developer, review, and QA agents can execute their full workflow (build, test, run app, make API requests) without requiring human approval for tool calls.

## Dependencies

None. This is a standalone configuration task.

## Requirements

### Part 1: Utility Scripts

Create a `scripts/agent/` directory at the project root with the following scripts. All scripts must:
- Be executable (`chmod +x`)
- Use `#!/usr/bin/env bash` shebang
- Use `set -e` for fail-fast behavior
- Resolve the project root from the script's own location: `PROJECT_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"`
- Source `$PROJECT_ROOT/.env` if it exists (for standalone use outside Claude Code)
- Print status messages to stderr, data to stdout
- Use proper exit codes (0 = success, non-zero = failure)

#### `build.sh`
- Runs `npm run build:app` from the project root
- Exit code reflects build success/failure

#### `build-docker.sh`
- Runs `npm run build:all` from the project root (builds app + Docker image)

#### `start-docker.sh`
- Runs `docker compose up -d` from the project root
- Polls `http://localhost:8080/api/tasks` every 2 seconds, up to 30 seconds
- Exits 0 and prints "App ready" to stderr when the app responds
- Exits 1 and prints "Timeout waiting for app" to stderr if 30 seconds pass without a response

#### `stop-docker.sh`
- Runs `docker compose down` from the project root
- Waits for containers to stop

#### `restart-docker.sh`
- Calls `stop-docker.sh` then `start-docker.sh` (using paths relative to the script's own directory)

#### `docker-status.sh`
- Runs `docker compose ps` from the project root
- Checks if port 8080 is responding with `curl -sf http://localhost:8080/api/tasks`
- Prints "running" or "stopped" to stdout
- If stopped, prints last 20 lines of container logs to stderr

#### `test.sh [type]`
- With no argument: runs `npm run test` (all tests)
- With `unit`: runs `npm run test:unit`
- With `integration`: runs `npm run test:integration`
- Runs from the project root

#### `curl-api.sh <method> <path> [body]`
- Makes HTTP requests to `http://localhost:8080`
- Usage: `curl-api.sh GET /api/tasks`
- Usage: `curl-api.sh POST /api/tasks '{"description":"test"}'`
- Sets `Content-Type: application/json` header when body is provided
- Pipes output through `jq` if available, falls back to raw output
- Prints the HTTP status code to stderr

#### `docker-logs.sh [lines]`
- Runs `docker compose logs --tail=<lines>` from the project root
- Default: 50 lines

### Part 2: Permission Allowlist Updates

All permissions go in `.claude/settings.json` (checked into git, shared across developers). No absolute paths — patterns use relative paths that work from the project root.

#### Project-level: `.claude/settings.json`

Add a `permissions.allow` array alongside the existing `hooks` key. Include:

**Utility scripts (invoked from project root after `cd`):**
- `Bash(scripts/agent/:*)` — covers all utility scripts

**Navigation:**
- `Bash(cd:*)` — allows agents to change to the project root at the start of their workflow

**Build and test:**
- `Bash(npm run build:*)` — build commands
- `Bash(npm run test:*)` — test commands
- `Bash(npm run clean:*)` — clean commands
- `Bash(npm run docker:*)` — docker npm scripts
- `Bash(npm test:*)` — direct npm test
- `Bash(npm install)` — install dependencies
- `Bash(npm run:*)` — other npm scripts
- `Bash(gren:*)` — Gren compiler

**Docker:**
- `Bash(docker compose:*)` — Docker Compose commands
- `Bash(docker build:*)` — Docker build
- `Bash(docker run *)` — Docker run
- `Bash(docker exec *)` — Docker exec
- `Bash(docker logs *)` — Docker logs
- `Bash(docker stop:*)` — Docker stop
- `Bash(docker images *)` — Docker images
- `Bash(docker rm *)` — Docker rm
- `Bash(docker info:*)` — Docker info
- `Bash(CHORUS_LOG_LEVEL=debug docker compose:*)` — Debug-mode Docker Compose

**HTTP and process management:**
- `Bash(curl:*)` — HTTP requests
- `Bash(lsof:*)` — port checking
- `Bash(kill:*)` — process management
- `Bash(pkill:*)` — process management by name

**Development tools:**
- `Bash(node:*)` — Node.js commands (inline inspection scripts)
- `Bash(jq:*)` — JSON processing
- `Bash(ls:*)` — directory listing
- `Bash(find:*)` — file finding
- `Bash(tree:*)` — directory tree
- `Bash(grep:*)` — text search
- `Bash(echo:*)` — output
- `Bash(env:*)` — environment inspection
- `Bash(claude:*)` — Claude CLI

**Web access:**
- `WebFetch(domain:gren-lang.org)`
- `WebFetch(domain:packages.gren-lang.org)`
- `WebFetch(domain:github.com)`
- `WebFetch(domain:raw.githubusercontent.com)`
- `WebFetch(domain:www.npmjs.com)`
- `WebSearch`

#### Sub-project: `src/chorus/.claude/settings.local.json`

Delete this file. It currently only allows `npm run build:app:*` and `npm run test:*`, which is too restrictive for sub-agents and may override the broader project-level permissions. All needed permissions are covered by the project root `.claude/settings.json`.

### Part 3: Agent Instruction Updates

#### `agents/developer.md`

Add the following section after the "Implementation Guidelines" section:

```markdown
## Working Directory and Utility Scripts

Before running any build, test, or Docker commands, ensure you are in the project root:

    cd $(git rev-parse --show-toplevel)

Use these scripts instead of constructing multi-step commands. Each script is a single command that runs without requiring approval. All paths are relative to the project root.

| Script | Usage |
|--------|-------|
| `scripts/agent/build.sh` | Build all app components |
| `scripts/agent/build-docker.sh` | Build app + Docker image |
| `scripts/agent/start-docker.sh` | Start app (Docker), wait for ready |
| `scripts/agent/stop-docker.sh` | Stop app |
| `scripts/agent/restart-docker.sh` | Restart app |
| `scripts/agent/docker-status.sh` | Check if app is running |
| `scripts/agent/test.sh [unit|integration]` | Run tests |
| `scripts/agent/curl-api.sh <METHOD> <PATH> [BODY]` | Test API endpoints |
| `scripts/agent/docker-logs.sh [lines]` | View container logs |

Important:
- The `.env` file is sourced automatically before each Bash command by a hook. Do NOT source it manually.
- The app runs through Docker. Do NOT run `node build/chorus.js` directly.
- Use separate tool calls for separate operations. Do NOT chain commands with `&&`, `&`, or `;`.
```

#### `agents/qa.md`

Add the same "Working Directory and Utility Scripts" section after the "Testing Approach" section, with identical content.

#### `agents/developer-review.md`

Add a shorter reference after the "Your Workflow" section:

```markdown
## Working Directory and Utility Scripts

Before running builds or tests, ensure you are in the project root:

    cd $(git rev-parse --show-toplevel)

Utility scripts are available at `scripts/agent/`. Use `scripts/agent/build.sh` to verify compilation and `scripts/agent/test.sh` to run the test suite. See `agents/developer.md` for the full list.

The `.env` file is sourced automatically. Do NOT source it manually.
```

#### `agents/orchestrator.md`

Update each sub-agent invocation template to include an instruction to navigate to the project root. Do NOT pass a hardcoded `PROJECT_ROOT` path — agents discover it via `git rev-parse --show-toplevel`.

For example, the Developer Agent template becomes:
```
Task tool:
  subagent_type: "general-purpose"
  description: "Developer implements task"
  prompt: |
    You are the Developer agent.

    ## Parameters
    TASK_FILE: {TASK_FILE}
    STATUS_FILE: workspaces/{task-name}/status.md
    REPORT_FILE: workspaces/{task-name}/reports/developer-{N}.md

    Before starting, navigate to the project root:
        cd $(git rev-parse --show-toplevel)

    Read your instructions from agents/developer.md, then execute your workflow using the parameters above.
```

Apply the same change to all sub-agent templates (Developer first iteration, Developer subsequent iterations for review feedback, Developer subsequent iterations for QA failures, Developer Review, QA, Planner).

## Acceptance Criteria

- [ ] All 9 utility scripts exist in `scripts/agent/` and are executable
- [ ] `build.sh` runs `npm run build:app` and exits 0 on success
- [ ] `start-docker.sh` starts Docker containers and waits for port 8080 to respond
- [ ] `stop-docker.sh` stops Docker containers
- [ ] `restart-docker.sh` stops then starts the app
- [ ] `docker-status.sh` correctly reports "running" or "stopped"
- [ ] `curl-api.sh GET /api/tasks` returns a response when app is running
- [ ] `test.sh` runs all tests, `test.sh unit` runs unit tests only
- [ ] `docker-logs.sh` shows container logs
- [ ] `.claude/settings.json` includes all permission patterns (no absolute paths)
- [ ] `.claude/settings.local.json` is deleted (permissions consolidated into `settings.json`)
- [ ] `src/chorus/.claude/settings.local.json` is deleted
- [ ] `agents/developer.md` has the "Working Directory and Utility Scripts" section
- [ ] `agents/qa.md` has the "Working Directory and Utility Scripts" section
- [ ] `agents/developer-review.md` has the utility scripts reference
- [ ] `agents/orchestrator.md` includes `cd $(git rev-parse --show-toplevel)` in all sub-agent templates
- [ ] No compound commands (`&&`, `&`, `;`) are needed to execute: build → start → test endpoint → stop

## Out of Scope

- Direct node execution (app runs through Docker only)
- Browser automation permissions
- Unrestricted `Bash(*)` access
- Changes to application code
- Changes to Docker or Docker Compose configuration
- Changes to the PreToolUse hook

## Technical Context

### Files to Create

- `scripts/agent/build.sh`
- `scripts/agent/build-docker.sh`
- `scripts/agent/start-docker.sh`
- `scripts/agent/stop-docker.sh`
- `scripts/agent/restart-docker.sh`
- `scripts/agent/docker-status.sh`
- `scripts/agent/test.sh`
- `scripts/agent/curl-api.sh`
- `scripts/agent/docker-logs.sh`

### Files to Modify

- `.claude/settings.json` — Add `permissions.allow` array alongside existing `hooks` key
- `agents/developer.md` — Add "Working Directory and Utility Scripts" section
- `agents/qa.md` — Add "Working Directory and Utility Scripts" section
- `agents/developer-review.md` — Add utility scripts reference
- `agents/orchestrator.md` — Add `cd $(git rev-parse --show-toplevel)` to all sub-agent templates

### Files to Delete

- `.claude/settings.local.json` — Existing permissions are consolidated into `.claude/settings.json`; this file becomes redundant
- `src/chorus/.claude/settings.local.json` — Too restrictive, may override project-level permissions

### Related Files (reference only)

- `.claude/hooks/source-env.sh` — Env sourcing hook (no changes needed)
- `docker-compose.yml` — Docker configuration (no changes needed)
- `package.json` — npm scripts (no changes needed, utility scripts call these internally)

### Patterns to Follow

- Scripts use `#!/usr/bin/env bash` and `set -e`
- Project root resolution: `PROJECT_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"`
- Status messages to stderr (`>&2`), data to stdout
- The `.env` sourcing pattern: `[ -f "$PROJECT_ROOT/.env" ] && set -a && source "$PROJECT_ROOT/.env" && set +a`
- Permission patterns use the format `Bash(prefix:*)` where `prefix` is the command start — no absolute paths in shared settings
- Agents find the project root via `git rev-parse --show-toplevel`, not hardcoded paths

## Testing Requirements

- Run each utility script individually to verify it works
- Verify `start-docker.sh` correctly waits for the app and reports readiness
- Verify `stop-docker.sh` cleanly stops containers
- Verify `curl-api.sh` works with GET (no body) and POST (with body)
- Verify `test.sh` correctly routes to unit/integration/all based on argument
- Test a full agent cycle: `build.sh` → `start-docker.sh` → `curl-api.sh GET /api/tasks` → `stop-docker.sh`
- Verify each command in the cycle matches an allowlist pattern (no approval prompts)

## Notes

- All permission patterns in `.claude/settings.json` use relative paths or command names — no absolute paths. This makes the configuration portable across developer machines.
- The existing `.claude/settings.local.json` contains permissions with machine-specific absolute paths (e.g., `git -C /Users/david/dev/chorus log --oneline`). All portable permissions are consolidated into `.claude/settings.json` and the `.local` file is deleted. Individual developers can recreate a `.claude/settings.local.json` for machine-specific additions if needed.
- Agents navigate to the project root via `cd $(git rev-parse --show-toplevel)` at the start of their workflow, then invoke scripts as `scripts/agent/build.sh` (relative). The `Bash(cd:*)` and `Bash(scripts/agent/:*)` patterns match these commands regardless of where the agent was originally spawned.
- The PreToolUse hook already sources `.env` before each Bash command in Claude Code sessions. The scripts source `.env` internally as well so they also work when run manually outside of Claude Code.
- Docker Compose manages container lifecycle (PIDs, signals, health). Agents do not need to track process IDs or use `kill`/`sleep`/`lsof` for app management — the scripts handle this.
- The `curl-api.sh` script is a thin wrapper. For complex API testing scenarios, agents can still use `curl` directly (which matches the `Bash(curl:*)` pattern).
- If an agent needs an operation not covered by the utility scripts, it should use a single-command tool call that matches an existing allowlist pattern rather than constructing a compound command.
- Both `.claude/settings.local.json` files are deleted. If sub-project-specific settings are needed in the future, create `src/chorus/.claude/settings.json` (shared, checked in) with permissions that are a superset of what agents need.
