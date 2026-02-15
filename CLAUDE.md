# Chorus

Multi-agent orchestration system written in Gren (Elm-like language that compiles to JS).

## Running the Application

```bash
# Build the app
npm run build:dist
```

The built binary is at `dist/chorus`. Run it directly — it starts on port 8080 by default. Data is stored in `./data` at the project root.

Available variables:

- `CHORUS_LOG_LEVEL` - Log verbosity: `error`, `warn`, `info` (default), `debug`

Log format: `[Chorus YYYY-MM-DDTHH:MM:SSZ] [LEVEL] message`

## Build Scripts

- `npm run build:all` - Build all components (UI, tools, chorus)
- `npm run build:dist` - Build all components and package into `dist/`

## Testing

```bash
npm run test
```

## Project Structure

- `packages/chorus/` - Main Chorus application (Gren), includes agent executor modules
- `packages/chorus-ui/` - Web UI (Gren)
- `packages/tools/` - CLI proxy (`chorus-tools`) that agents invoke to execute tool calls (file operations, handoff) via the Chorus server
- `data/` - Persistent data directory (created on first start)

## Command Line Tools

Prefer these tools over their slower alternatives:

- `rg` (ripgrep) instead of `grep`
- `fd` instead of `find`
- `jq` instead of using Python to parse/validate JSON

## Workspace vs Allowed Directories

A Chorus app has two distinct directory concepts:

- **Workspace**: The location of the `chorus.json` config file. This is where Chorus stores its own files — the task registry (`{workspace-parent}/registry/`), agent configuration files, etc. It is the app's internal working directory.
- **Allowed directories** (`allowedAgentDirectories` in `chorus.json`): The directories a user has granted agents permission to access for file operations. These are the sandboxed paths that agents' file tools can read/write within. They are typically *not* the same location as the workspace — they point to the user's project directories or other locations the user wants agents to work in.

The `initialAgentDirectory` (where agent configs are loaded from) must be within the allowed directories.

## Key Constraints

- Do not create `packages/chorus/data/` - data lives in `./data` at the project root
- No backwards compatibility: decoders must decode exactly what the types require. Do not add defaults, fallbacks, or value conversions unless explicitly specified.
