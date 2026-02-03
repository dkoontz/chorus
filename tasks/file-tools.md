# Task: Implement File Tool Runtime

## Summary

Build the file tool runtime in Gren that provides sandboxed file operations for agents. This is the foundation of the Chorus tool layer.

## Requirements

- Implement six file tools: `read`, `write`, `patch`, `delete`, `list`, `search`
- All operations scoped to a designated workspace directory
- Path traversal attacks prevented (no `..` escaping workspace)
- JSON input/output for all tools
- Clear error messages for agent feedback

## Tools Specification

| Tool | Input | Output |
|------|-------|--------|
| `file.read` | `{path, offset?, limit?}` | `{content, total_lines, truncated}` |
| `file.write` | `{path, content}` | `{success, bytes_written}` |
| `file.patch` | `{path, patches: [{find, replace}]}` | `{success, patches_applied}` |
| `file.delete` | `{path}` | `{success}` |
| `file.list` | `{path?, pattern?}` | `{files: [{path, size, modified}]}` |
| `file.search` | `{pattern, path?, glob?, case_sensitive?, context_lines?, max_results?}` | `{matches: [{path, line, content}], truncated}` |

## Acceptance Criteria

- [ ] Workspace root is configurable at runtime
- [ ] All paths validated to be within workspace before any operation
- [ ] `file.read` returns line-numbered content, supports pagination
- [ ] `file.write` creates parent directories if needed
- [ ] `file.patch` fails with clear error if find string is not unique or not found
- [ ] `file.delete` refuses to delete directories (separate tool later if needed)
- [ ] `file.list` supports glob patterns via library or shell-out to `find`
- [ ] `file.search` uses ripgrep for performance, handles missing `rg` gracefully
- [ ] All tools return structured JSON errors, not exceptions
- [ ] Unit tests for path traversal prevention
- [ ] Unit tests for each tool's happy path and error cases

## Technical Context

**Language:** Gren (compiles to Node.js)

**Project structure:**
```
src/
  Tools/
    File.gren          # File tool implementations
    Validation.gren    # Path validation, sandboxing
  Main.gren            # CLI entry point for testing
tests/
  FileTests.gren       # Unit tests
```

**Dependencies:**
- Gren standard library for file I/O
- ripgrep (`rg`) as external binary for search

## Security Model

Tools and agent specs are read-only (owned by root or privileged user). The agent process runs as a restricted user with write access only to workspace directories. System records are written only by the tool runtime, not directly by agents.

```
/opt/chorus/tools/       # Read-only - tool executables
/var/chorus/workspaces/  # Read-write - agent working directories
/var/chorus/records/     # Tool-writable only - system record
```

## Future Tools (to be planned later)

- HTTP requests
- SSH/SCP
- Web search
- Cron jobs
- Agent support tools (notes, delegate, system requests)

## Notes

- This is the first component of the Chorus system
- Focus on correctness and security over performance initially
- Error messages should be helpful for an AI agent to understand what went wrong
