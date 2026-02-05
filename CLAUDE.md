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

## Debugging

Set `CHORUS_LOG_LEVEL` to control log verbosity:

- `error` - Only errors
- `warn` - Warnings and errors
- `info` - Normal operation (default)
- `debug` - Verbose output including request bodies, file operations

```bash
# Run with debug logging
docker run -p 8080:8080 -e CHORUS_LOG_LEVEL=debug -v ./docker-data:/app/data chorus

# View container logs
docker logs <container-id>
docker logs -f <container-id>  # Follow logs
```

Log format: `[Chorus YYYY-MM-DDTHH:MM:SSZ] [LEVEL] message`

## Build Scripts

- `npm run build:app` - Build all components (UI, tools, agent-executor, chorus)
- `npm run build:docker` - Build Docker image
- `npm run build:all` - Build app + Docker image

## Testing

```bash
npm run test          # Run all tests
npm run test:unit     # Unit tests only
npm run test:integration  # Integration tests only
```

## Project Structure

- `src/chorus/` - Main Chorus application (Gren)
- `src/chorus-ui/` - Web UI (Gren)
- `src/tools/` - File tools
- `src/agent-executor/` - Agent executor
- `docker-data/` - Persistent data directory (Docker volume mount)

## Key Constraints

- Do not create `src/chorus/data/` - data lives only in Docker volume mount
- Do not add direct execution scripts (`start`, `dev`) - all runtime goes through Docker
