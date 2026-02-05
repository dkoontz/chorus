# Chorus

Multi-agent orchestration system written in Gren (Elm-like language that compiles to JS).

## Running the Application

**Docker is the only supported way to run Chorus.**

```bash
# Build everything (app + Docker image)
npm run build:all

# Run with Docker directly
npm run docker:run

# Or use Docker Compose
npm run docker:compose
```

The app runs on port 8080. Data is persisted via Docker volume mount at `./docker-data:/app/data`.

## Claude Code Authentication

The agent-executor uses Claude Code CLI. First-time setup requires authentication:

```bash
# Start the container
npm run docker:compose

# Login to Claude Code (opens browser for OAuth)
docker exec -it chorus-chorus-1 claude login

# Verify authentication
docker exec -it chorus-chorus-1 claude --version
```

Credentials are persisted in `./docker-data/.claude/` and survive container restarts.

## Environment Variables

Environment variables are managed via `.env` in the project root (gitignored, template at `.env.example`).

A PreToolUse hook (`.claude/hooks/source-env.sh`) sources `.env` before every Bash command. This means changes to `.env` take effect immediately without restarting the session. Docker Compose also reads `.env` natively.

To change a variable mid-session, edit `.env` directly:

```bash
# Example: switch to debug logging
echo "CHORUS_LOG_LEVEL=debug" > .env
```

Available variables:

- `CHORUS_LOG_LEVEL` - Log verbosity: `error`, `warn`, `info` (default), `debug`

Log format: `[Chorus YYYY-MM-DDTHH:MM:SSZ] [LEVEL] message`

## Build Scripts

- `npm run build:app` - Build all components (UI, tools, chorus)
- `npm run build:docker` - Build Docker image
- `npm run build:all` - Build app + Docker image

## Testing

```bash
npm run test          # Run all tests
npm run test:unit     # Unit tests only
npm run test:integration  # Integration tests only
```

## Project Structure

- `src/chorus/` - Main Chorus application (Gren), includes agent executor modules
- `src/chorus-ui/` - Web UI (Gren)
- `src/tools/` - File tools
- `docker-data/` - Persistent data directory (Docker volume mount)

## Command Line Tools

Prefer these tools over their slower alternatives:

- `rg` (ripgrep) instead of `grep`
- `fd` instead of `find`
- `jq` instead of using Python to parse/validate JSON

## Key Constraints

- Do not create `src/chorus/data/` - data lives only in Docker volume mount
- Do not add direct execution scripts (`start`, `dev`) - all runtime goes through Docker
