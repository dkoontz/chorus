# Task: Docker Containerization

Build the Chorus application as a Docker container for reproducible deployment.

## Background

Chorus is a multi-agent orchestration system written in Gren (compiles to Node.js). It consists of several components:
- **chorus** - Main HTTP server (port 8080)
- **chorus-ui** - Browser-based web interface
- **agent-executor** - Agent execution engine
- **file-tools** - Sandboxed file operations (compiled to binary via Bun)

Currently there is no containerization. The application runs directly on the host system.

### Important: Directory Structure Clarification

The repository contains two distinct sets of directories that serve different purposes:

**Development workflow directories (DO NOT containerize):**
- `/agents/` - Agent prompts for building Chorus (orchestrator, planner, developer, QA)
- `/tasks/` - Task specifications for development workflow
- `/workspaces/` - Output from development workflow runs

**Application runtime data:**
- Currently at `src/chorus/data/` - this is wrong, data is comingled with source
- Should be at `build/data/` (already gitignored via `build/`)
- Subdirectories: `build/data/registry/`, `build/data/workspaces/`

The Docker container should NOT include any of the development workflow directories. Application data should be volume-mounted at runtime, not baked into the image.

### Data Directory Relocation

Move application data from `src/chorus/data/` to `build/data/`:
- Update `src/chorus/src/Main.gren` to use `./build/data/` as the data root
- Or make the data path configurable via environment variable (preferred for Docker)
- Ensure the application creates the directories if they don't exist

## Requirements

### Dockerfile

Create a multi-stage Dockerfile at the repository root:

1. **Build stage**
   - Base image: Node.js (LTS)
   - Install Gren compiler (0.6.3)
   - Install Bun (for binary compilation)
   - Build all components in order:
     - `src/chorus-ui` (browser JS)
     - `src/tools` (file-tools binary)
     - `src/agent-executor` (Node.js)
     - `src/chorus` (main app + copy UI assets)

2. **Runtime stage**
   - Base image: Node.js (slim)
   - Copy only compiled artifacts from build stage
   - Set working directory
   - Expose port 8080
   - Entry point: `node build/chorus.js`

### Host Binding Fix

The server currently binds to `localhost`. For container access, it needs to bind to `0.0.0.0`. Update `src/chorus/src/Main.gren`:
- Change host from `localhost` to `0.0.0.0`
- Or make it configurable via environment variable

### Docker Compose

Create `docker-compose.yml` for local development:
- Build from Dockerfile
- Mount volume for application data (host path configurable, maps to `/app/data` in container)
- Map port 8080
- Environment variable for data path (e.g., `DATA_DIR=/app/data`)

### .dockerignore

Create `.dockerignore` to exclude:

**Development workflow directories (not part of deployed app):**
- `agents/`
- `tasks/`
- `workspaces/`

**Build artifacts and caches:**
- `.git/`
- `.gren/`
- `gren_packages/`
- `node_modules/`
- `**/build/` (will be rebuilt in container)

**Application runtime data (mounted at runtime, not baked in):**
- `build/data/`
- `src/chorus/data/` (legacy location, if any remains)

**Documentation:**
- `*.md`
- `docs/`

## Acceptance Criteria

1. `docker build -t chorus .` completes without errors
2. `docker run -p 8080:8080 chorus` starts the server
3. Web UI accessible at `http://localhost:8080` from host machine
4. Container size is reasonable (< 500MB for runtime image)
5. Application data persists across container restarts when using volume mounts
6. Development workflow directories (`agents/`, `tasks/`, `workspaces/` at repo root) are not in the image
7. Application data path is configurable via environment variable
8. No source files are comingled with runtime data

## Out of Scope

- CI/CD pipeline configuration
- Container registry publishing
- Kubernetes manifests
- Production hardening (non-root user, health checks) - these can be added later

## Files to Create/Modify

- Create: `Dockerfile`
- Create: `docker-compose.yml`
- Create: `.dockerignore`
- Modify: `src/chorus/src/Main.gren` (host binding, configurable data path)
- Delete: `src/chorus/data/` (move any needed seed data to appropriate location)
