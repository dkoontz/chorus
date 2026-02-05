# QA Report

## Summary
The Docker build fails due to an incorrect npm package name in the Dockerfile. The Gren compiler is published as `gren-lang` on npm, not `gren`. This is a blocker that prevents any further testing of the containerization implementation.

## Test Scenarios

### Scenario 1: Docker Image Build
- **Description:** Build the Docker image using `docker build -t chorus .`
- **Steps:**
  1. Run `docker build -t chorus .` from the repository root
- **Expected:** Docker image builds without errors
- **Actual:** Build fails at step 2/14 with error: `npm error notarget No matching version found for gren@0.6.3`
- **Status:** FAIL

### Scenario 2: Verify .dockerignore Excludes Development Directories
- **Description:** Verify that .dockerignore properly lists the development workflow directories
- **Steps:**
  1. Read the .dockerignore file
  2. Verify `agents/`, `tasks/`, and `workspaces/` are listed
- **Expected:** All three directories are excluded
- **Actual:** All three directories are properly listed in .dockerignore
- **Status:** PASS

### Scenario 3: Verify Environment Variable Configuration
- **Description:** Verify Main.gren supports configurable host, port, and data directory via environment variables
- **Steps:**
  1. Read src/chorus/src/Main.gren
  2. Verify `configFromEnv` function exists
  3. Verify it reads CHORUS_HOST, CHORUS_PORT, CHORUS_DATA_DIR, CHORUS_STATIC_DIR
- **Expected:** All environment variables are supported
- **Actual:** All four environment variables are properly implemented in `configFromEnv` function (lines 100-125)
- **Status:** PASS

### Scenario 4: Verify Host Binding Changed to 0.0.0.0
- **Description:** Verify the default host binding was changed from localhost to 0.0.0.0 for container access
- **Steps:**
  1. Read src/chorus/src/Main.gren
  2. Check the defaultConfig host value
- **Expected:** Host is set to "0.0.0.0"
- **Actual:** defaultConfig.host is "0.0.0.0" (line 84)
- **Status:** PASS

### Scenario 5: Verify docker-compose.yml Configuration
- **Description:** Verify docker-compose.yml is properly configured with volume mounts and environment variables
- **Steps:**
  1. Read docker-compose.yml
  2. Verify volume mount for data directory
  3. Verify environment variables are set
  4. Verify port mapping is present
- **Expected:** All configuration elements are present
- **Actual:** docker-compose.yml contains proper volume mount (`${DATA_PATH:-./docker-data}:/app/data`), environment variables (CHORUS_HOST, CHORUS_PORT, CHORUS_DATA_DIR, CHORUS_STATIC_DIR), and port mapping (`${CHORUS_PORT:-8080}:8080`)
- **Status:** PASS

### Scenario 6: Verify Legacy Data Directory Removal
- **Description:** Verify that src/chorus/data/ has been removed as specified in the task
- **Steps:**
  1. Check if src/chorus/data/ directory exists
- **Expected:** Directory should not exist (task specifies to delete it)
- **Actual:** Directory still exists with registry/ and workspaces/ subdirectories
- **Status:** FAIL

### Scenario 7: Docker Container Run
- **Description:** Start the container and verify the server is accessible
- **Steps:**
  1. Run `docker run -p 8080:8080 chorus`
  2. Access http://localhost:8080 from host
- **Expected:** Web UI is accessible
- **Actual:** Cannot test - Docker build fails (see Scenario 1)
- **Status:** BLOCKED

### Scenario 8: Data Persistence with Volume Mount
- **Description:** Verify application data persists when using volume mounts
- **Steps:**
  1. Start container with volume mount
  2. Create data via the application
  3. Stop and restart container
  4. Verify data persists
- **Expected:** Data persists across container restarts
- **Actual:** Cannot test - Docker build fails (see Scenario 1)
- **Status:** BLOCKED

### Scenario 9: Container Image Size
- **Description:** Verify container size is under 500MB as specified in acceptance criteria
- **Steps:**
  1. Build Docker image
  2. Check image size with `docker images`
- **Expected:** Image size < 500MB
- **Actual:** Cannot test - Docker build fails (see Scenario 1)
- **Status:** BLOCKED

## Failures

### Failure 1: Wrong npm Package Name for Gren Compiler
- **Scenario:** Scenario 1: Docker Image Build
- **Reproduction Steps:**
  1. Run `docker build -t chorus .` from repository root
  2. Observe build failure at step 2/14
- **Expected Behavior:** npm should install gren@0.6.3 successfully
- **Actual Behavior:** npm reports "No matching version found for gren@0.6.3" because the package is named `gren-lang` on npm, not `gren`
- **Severity:** BLOCKER

### Failure 2: Legacy Data Directory Not Removed
- **Scenario:** Scenario 6: Verify Legacy Data Directory Removal
- **Reproduction Steps:**
  1. Run `ls -la src/chorus/data/`
  2. Observe that directory exists with registry/ and workspaces/ subdirectories
- **Expected Behavior:** Per task requirements: "Delete: `src/chorus/data/` (move any needed seed data to appropriate location)"
- **Actual Behavior:** Directory still exists at `src/chorus/data/` with contents
- **Severity:** MINOR (does not affect Docker build, but violates task requirements and leaves source code comingled with runtime data)

## Test Code Quality Issues

No test code was added for this feature. This is expected since Docker containerization is infrastructure rather than application logic, and the existing integration test framework is designed for file tools testing, not Docker testing.

## Integration Tests Added

| Test Name | File | Validates |
|-----------|------|-----------|
| N/A | N/A | N/A |

No integration tests were added. The existing integration test framework at `src/tools/tests/integration/` is designed for testing file operations tools (file-read, file-write, file-patch, etc.) and is not applicable to Docker containerization testing. Docker testing would require a separate test harness or manual verification.

## Overall Assessment

**Decision:** FAIL

The implementation cannot be verified because the Docker build fails due to a critical bug in the Dockerfile. The Gren compiler npm package is named `gren-lang`, not `gren`.

**Blocking Issues That Must Be Resolved:**

1. **Dockerfile line 11:** Change `npm install -g gren@0.6.3` to `npm install -g gren-lang@0.6.3`

**Non-Blocking Issues:**

1. **Legacy data directory not removed:** The directory `src/chorus/data/` still exists. Per the task specification, this should be deleted to prevent source files from being comingled with runtime data. This should be addressed but does not block the Docker implementation.
