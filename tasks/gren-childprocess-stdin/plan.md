# Add stdin Control to Gren ChildProcess.run

## Summary

The `ChildProcess.run` function in `gren-lang/node` should provide an option to control how stdin is handled for child processes. Currently, stdin is inherited from the parent process, which can cause child processes to hang when the parent has a long-lived stdin stream.

## Problem

When a Gren program reads from stdin and then spawns a child process using `ChildProcess.run`, the child inherits the parent's stdin file descriptor. If the parent's stdin stream remains open (common in long-running programs), the child process may block waiting for EOF on stdin that never arrives.

This was discovered when using `ChildProcess.run` to invoke the Claude CLI from an executor that reads JSON parameters from stdin. The CLI would hang indefinitely until the 2-minute timeout, despite completing in ~2 seconds when run directly from a shell.

### Root Cause

`ChildProcess.run` uses Node.js's `execFile` without specifying the `stdio` option:

```javascript
// Current implementation in gren-lang/node
childProcess.execFile(
  options.program,
  options._arguments,
  cmdOptions,  // No stdio option set
  cmdCallback
);
```

Node.js's default behavior inherits stdio from the parent, which causes issues when:
1. Parent process has stdin open (e.g., after reading input)
2. Child process or its runtime checks stdin state
3. Child waits for EOF that never comes because parent is still running

## Proposed Solution

Add a `stdin` field to the `RunOptions` type that controls stdin handling:

```gren
type StdinBehavior
    = InheritStdin      -- Current behavior (inherit from parent)
    | IgnoreStdin       -- Close stdin for child (redirect from /dev/null equivalent)
    | PipeStdin Bytes   -- Pipe specific data to child's stdin

type alias RunOptions =
    { shell : Shell
    , workingDirectory : WorkingDirectory
    , environmentVariables : EnvironmentVariables
    , maximumBytesWrittenToStreams : Int
    , runDuration : RunDuration
    , stdin : StdinBehavior  -- NEW FIELD
    }
```

The JavaScript implementation would map these to Node.js stdio options:

```javascript
function mapStdinBehavior(stdin) {
  switch (stdin.$) {
    case 'InheritStdin':
      return 'inherit';
    case 'IgnoreStdin':
      return 'ignore';
    case 'PipeStdin':
      return 'pipe';  // Plus write stdin.data to child.stdin
  }
}

// In _ChildProcess_run:
var cmdOptions = {
  // ... existing options ...
  stdio: [mapStdinBehavior(options.stdin), 'pipe', 'pipe']
};
```

## Alternative: Change Default Behavior

A simpler alternative would be to change the default to `stdio: ['ignore', 'pipe', 'pipe']` since most use cases for `ChildProcess.run` don't need stdin input. This would be a breaking change but likely matches user expectations better.

## Acceptance Criteria

- [ ] `ChildProcess.run` supports controlling stdin behavior
- [ ] Default behavior prevents hanging when parent has open stdin
- [ ] Documentation explains stdin options and when to use each
- [ ] Backwards compatibility considered (or breaking change documented)

## Workaround

Until this is fixed, the workaround is to wrap commands in `bash -c "command </dev/null"`:

```gren
ChildProcess.run permission "bash" [ "-c", "claude --version </dev/null" ] options
```

## Related

- Downstream issue: Agent executor stdin hang (fixed with bash workaround)
- Node.js docs: https://nodejs.org/api/child_process.html#optionsstdio
