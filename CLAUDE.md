# Chorus

Multi-agent orchestration system written in Gren (Elm-like language that compiles to JS).

## Running the Application

```bash
# Build the app
npm run build:all

# Start the app (runs in background, logs to /tmp)
npm run start

# View logs
npm run logs

# Stop the app
npm run stop
```

The app runs on port 8080. Data is stored in `./data` at the project root.

## Environment Variables

Environment variables are managed via `.env` in the project root (gitignored, template at `.env.example`).

A PreToolUse hook (`.claude/hooks/source-env.sh`) sources `.env` before every Bash command. This means changes to `.env` take effect immediately without restarting the session.

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
- `npm run build:all` - Same as `build:app`

## Testing

```bash
npm run test          # Run all tests
npm run test:unit     # Unit tests only
npm run test:integration  # Integration tests only
```

## Project Structure

- `packages/chorus/` - Main Chorus application (Gren), includes agent executor modules
- `packages/chorus-ui/` - Web UI (Gren)
- `packages/tools/` - File tools
- `data/` - Persistent data directory (created on first start)

## Command Line Tools

Prefer these tools over their slower alternatives:

- `rg` (ripgrep) instead of `grep`
- `fd` instead of `find`
- `jq` instead of using Python to parse/validate JSON

## Key Constraints

- Do not create `packages/chorus/data/` - data lives in `./data` at the project root
- No backwards compatibility: decoders must decode exactly what the types require. Do not add defaults, fallbacks, or value conversions unless explicitly specified.
