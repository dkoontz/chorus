# Code Review Report

## Summary

The implementation creates 9 utility scripts in `scripts/agent/`, configures permission allowlists in `.claude/settings.json`, updates agent instruction files, and removes the two `settings.local.json` files. The code is functional and follows the task spec closely. Two scripts deviate from the required conventions and one has a minor correctness concern.

## Issues Found

### BLOCKING Issues

#### Issue 1: `curl-api.sh` missing PROJECT_ROOT and .env sourcing
- **File:** `scripts/agent/curl-api.sh`
- **Line:** 1-7
- **Category:** Style
- **Description:** The task specification states that *all* scripts must resolve `PROJECT_ROOT` and source `.env` if it exists. `curl-api.sh` does neither. While the script does not currently need `PROJECT_ROOT` to function (it uses a hardcoded `localhost:8080` base URL), the requirement is explicit and exists to maintain consistency and to support future changes where environment variables might configure the base URL or port.
- **Suggestion:** Add the standard preamble after `set -e`:
  ```bash
  PROJECT_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
  [ -f "$PROJECT_ROOT/.env" ] && set -a && source "$PROJECT_ROOT/.env" && set +a
  ```

#### Issue 2: `restart-docker.sh` missing PROJECT_ROOT and .env sourcing
- **File:** `scripts/agent/restart-docker.sh`
- **Line:** 1-7
- **Category:** Style
- **Description:** Same issue as `curl-api.sh`. The developer report notes this was intentional because the child scripts handle `.env` sourcing. While this works in practice, the task spec says "all scripts must" include these lines. The developer deviated from the spec without the task requesting an exception.
- **Suggestion:** Add the standard preamble. The `SCRIPT_DIR` variable can remain since it is still needed:
  ```bash
  PROJECT_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
  [ -f "$PROJECT_ROOT/.env" ] && set -a && source "$PROJECT_ROOT/.env" && set +a

  SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
  ```

### Suggestions

#### Suggestion 1: Developer report states incorrect permission count
- **File:** `workspaces/agent-permissions/reports/developer-1.md`
- **Line:** 18
- **Category:** Correctness
- **Description:** The report says "36 permission patterns" but the actual `.claude/settings.json` contains 39 entries. This is a report inaccuracy, not a code issue.
- **Suggestion:** Update the report to say 39 instead of 36, or remove the specific count.

#### Suggestion 2: Consider extracting BASE_URL in curl-api.sh to use an env var
- **File:** `scripts/agent/curl-api.sh`
- **Line:** 13
- **Category:** Simplification
- **Description:** The base URL `http://localhost:8080` is hardcoded. Once `.env` sourcing is added (per blocking issue 1), this could read from an environment variable with a default, making the script more flexible if the port ever changes.
- **Suggestion:** Use something like `BASE_URL="${CHORUS_BASE_URL:-http://localhost:8080}"`. This is not required for this task but would be a natural follow-up.

#### Suggestion 3: `start-docker.sh` and `docker-status.sh` also hardcode localhost:8080
- **File:** `scripts/agent/start-docker.sh`
- **Line:** 14
- **Category:** Duplication
- **Description:** The URL `http://localhost:8080/api/tasks` appears in both `start-docker.sh` (line 14) and `docker-status.sh` (line 10). If the port or health-check endpoint changes, both files need updating.
- **Suggestion:** This is minor and acceptable for now. If these scripts grow, consider extracting the URL to a shared variable or a small config snippet.

## Overall Assessment

**Decision:** CHANGES REQUESTED

The two blocking issues are about consistency with the task specification's explicit "all scripts must" requirements. The deviations are understandable from a pragmatic standpoint (the scripts work correctly without the preamble), but the task spec is clear and there is no stated exception. Fixing these is straightforward -- add two lines to each script.
