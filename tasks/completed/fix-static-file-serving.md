# Fix Static File Serving to Resolve Paths Relative to Binary Location

## Summary
Change the default paths for static files (and other relative paths like data, tools) to resolve relative to the binary's location (`env.applicationPath`) instead of the current working directory. This ensures the web UI loads correctly regardless of where the binary is launched from.

## Requirements
- Resolve `staticRoot` relative to the binary's parent directory using `env.applicationPath` from `Node.Environment`
- Resolve `dataDir` (and its sub-paths: registryRoot, workspacesRoot, uploadDir, agentsRoot) relative to the binary's parent directory
- Resolve `chorusToolsPath` relative to the binary's parent directory
- Environment variable overrides (`CHORUS_STATIC_DIR`, `CHORUS_DATA_DIR`, `CHORUS_TOOLS_PATH`, `CHORUS_UPLOAD_DIR`) continue to work and take precedence over computed defaults
- The `configFromEnv` function needs access to the binary's parent directory path to compute defaults

## Success Criteria
- [ ] Default `staticRoot` is computed as `<binary_parent>/static` instead of `./static`
- [ ] Default `dataDir` is computed as `<binary_parent>/data` instead of `./data`
- [ ] Default `chorusToolsPath` is computed as `<binary_parent>/tools/chorus-tools` instead of `./tools/chorus-tools`
- [ ] Environment variable overrides still take precedence over defaults
- [ ] Running the binary from a different directory than `dist/` serves the web UI correctly
- [ ] Running the binary from within `dist/` continues to work
- [ ] `npm run build:all` succeeds
- [ ] `npm run test` passes

## Out of Scope
- Changing the dist directory layout
- Changing the start script behavior
- Adding new environment variables

## Technical Context

### Files to Modify
- `packages/chorus/src/Main.gren` -- Update `defaultConfig` and `configFromEnv` to compute paths relative to binary location using `env.applicationPath`. The `init` function has access to `env` and needs to pass the binary's parent directory into `configFromEnv` (or compute the base path and use it when constructing config).

### Related Files (reference only)
- `packages/chorus/src/Web/Static.gren` -- Reads files from `staticRoot`; no changes needed since it already receives a path via config
- `scripts/build-dist.sh` -- Defines the dist layout: `chorus` binary, `static/`, `tools/`
- `scripts/agent/start.sh` -- Currently does `cd dist` before running; will continue to work

### Patterns to Follow
- `env.applicationPath` is a `Path` (from `FileSystem.Path`) giving the full path to the binary
- `Path.parentPath : Path -> Maybe Path` returns the binary's parent directory
- `Path.append`, `Path.prepend`, `Path.fromPosixString` for constructing sibling paths
- Approach: in `init`, compute `baseDir` from `env.applicationPath |> Path.parentPath`, convert to a posix string, and pass it to `configFromEnv` to use as the prefix for default paths instead of `"."`
- Handle the `Maybe` from `Path.parentPath` by falling back to `"."` (cwd) if the parent cannot be determined

## Testing Requirements
- Build the dist with `npm run build:all`
- From the project root, run `./dist/chorus` and verify the web UI loads at `http://localhost:8080`
- From within `dist/`, run `./chorus` and verify it still works
- Verify API endpoints function from both locations
- Verify environment variable overrides still work (e.g., `CHORUS_STATIC_DIR=/custom/path`)

## Notes
- `Node.Environment.applicationPath` is of type `Path` and gives the path to the executing binary
- All paths in `defaultConfig` currently use `./` relative paths that assume cwd is `dist/` -- these all need to be relative to the binary location instead
- The dist layout places sibling directories next to the binary: `static/`, `tools/`, `data/`
- Since the application will eventually be bundled into an OS-specific package, binary-relative paths are the correct long-term approach
