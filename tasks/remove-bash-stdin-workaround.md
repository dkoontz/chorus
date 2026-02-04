# Remove bash -c Stdin Workaround from ClaudeCode Provider

## Summary

Remove the `bash -c "... </dev/null"` workaround from the ClaudeCode provider once `gren-lang/node` supports stdin control in `ChildProcess.run`.

## Background

The ClaudeCode provider currently wraps all Claude CLI calls in `bash -c "... </dev/null"` to work around a limitation in Gren's `ChildProcess.run` where stdin is inherited from the parent process, causing the CLI to hang.

Once the upstream fix is available (see `tasks/gren-childprocess-stdin.md`), this workaround should be removed to:
- Simplify the code
- Avoid shell escaping complexity
- Improve performance (no bash subprocess)
- Make error messages clearer (no shell wrapper in stack traces)

## Prerequisites

- [ ] `gren-lang/node` releases version with stdin control for `ChildProcess.run`
- [ ] Update `gren.json` to use the new version

## Changes Required

### 1. Update RunOptions to use IgnoreStdin

In `validateEnvironment`, `createSession`, and `sendMessage`, change:

```gren
-- Before
options =
    { shell = ChildProcess.NoShell
    , ...
    }
ChildProcess.run permission "bash" [ "-c", shellCommand ] options

-- After
options =
    { shell = ChildProcess.NoShell
    , stdin = ChildProcess.IgnoreStdin  -- NEW
    , ...
    }
ChildProcess.run permission "claude" args options
```

### 2. Remove buildShellCommand Function

Delete the `buildShellCommand` function and its shell escaping logic (lines ~347-394 in ClaudeCode.gren).

### 3. Simplify validateEnvironment

```gren
-- Before
claudeCmd = "claude --version </dev/null"
ChildProcess.run permission "bash" [ "-c", claudeCmd ] options

-- After
ChildProcess.run permission "claude" [ "--version" ] options
```

### 4. Simplify createSession and sendMessage

Revert to using `buildCliArgs` directly instead of `buildShellCommand`:

```gren
-- Before
shellCommand = buildShellCommand cliArgs
ChildProcess.run permission "bash" [ "-c", shellCommand ] options

-- After
args = buildCliArgs cliArgs
ChildProcess.run permission "claude" args options
```

## Files to Modify

- `src/agent-executor/src/Provider/ClaudeCode.gren`

## Testing

- Run executor end-to-end test: `echo '{}' | node build/agent-executor.js agents/developer.md /tmp/test`
- Verify session creation succeeds
- Verify message sending works
- Verify error handling still works (test with invalid paths)

## Acceptance Criteria

- [ ] No `bash -c` wrapper in ClaudeCode provider
- [ ] No `buildShellCommand` function
- [ ] All CLI calls use `ChildProcess.run` directly with `IgnoreStdin`
- [ ] End-to-end tests pass
- [ ] Error messages show direct claude CLI invocation (not bash wrapper)
