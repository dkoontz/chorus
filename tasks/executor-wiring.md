# Wire Up Main.gren to Use Executor Module

## Summary

Update Main.gren to use the Executor module for running the conversation loop with the Claude Code CLI provider, replacing the current placeholder that only parses the agent spec and outputs status.

## Requirements

- Convert Main.gren from `Node.defineSimpleProgram` to `Node.defineProgram` to support the message loop
- Initialize the Executor with the ClaudeCode provider using the existing `Provider.ClaudeCode.provider` function
- Read initial message/parameters from stdin as JSON
- Wire up the Executor's `init`, `update`, and `subscriptions` functions to the Node program
- Handle Executor state transitions and trigger appropriate side effects
- Output final response to stdout when conversation completes
- Persist session ID to workspace for future resume
- Exit with appropriate status codes (0 for success, 1 for errors)

## Acceptance Criteria

- [ ] Main.gren uses `Node.defineProgram` instead of `Node.defineSimpleProgram`
- [ ] Main.gren defines `Model`, `Msg`, `init`, `update`, and `subscriptions` functions
- [ ] Main.Msg wraps Executor.Msg appropriately
- [ ] ClaudeCode provider is initialized with ChildProcess.Permission and file-tools path
- [ ] Initial message is read from stdin (JSON format with parameters)
- [ ] Executor.init is called after parsing the agent spec
- [ ] Executor.update handles AgentSpecLoaded, EnvironmentValidated, SessionCreated, MessageSent messages
- [ ] When Executor reaches Active state with a session, initial message is sent to provider
- [ ] When Executor reaches Complete state, final response is written to stdout
- [ ] When Executor reaches Failed state, error is written to stderr and exit code set to 1
- [ ] Session ID is persisted to `{workspace}/.session` after conversation completes
- [ ] Existing argument parsing logic is preserved

## Out of Scope

- Tool execution loop (the CLI handles this internally)
- Streaming responses
- Session resume functionality (exists in Executor but not wired up in this task)
- Changes to Provider, Provider.ClaudeCode, Agent.Executor, or Agent.Spec modules
- Unit tests for Main.gren (integration testing is more appropriate)

## Technical Context

### Files to Modify

- `src/agent-executor/src/Main.gren` - Convert to full Node.defineProgram pattern with Executor integration

### Related Files (reference only)

- `src/agent-executor/src/Agent/Executor.gren` - State machine with Model/Msg/update pattern
- `src/agent-executor/src/Provider.gren` - Provider interface types
- `src/agent-executor/src/Provider/ClaudeCode.gren` - Claude CLI provider implementation
- `src/agent-executor/src/Agent/Spec.gren` - Agent spec parsing

### Patterns to Follow

**Node.defineProgram pattern:**
```gren
main : Node.Program Model Msg
main =
    Node.defineProgram
        { init = init
        , update = update
        , subscriptions = subscriptions
        }

init : Node.Environment -> Init.Task { model : Model, command : Cmd Msg }
init env =
    Init.await FileSystem.initialize <| \fsPermission ->
        Init.await ChildProcess.initialize <| \cpPermission ->
            Node.startProgram
                { model = initialModel
                , command = initialCommand
                }

update : Msg -> Model -> { model : Model, command : Cmd Msg }
update msg model =
    when msg is
        SomeMsg data ->
            { model = newModel, command = someCommand }

subscriptions : Model -> Sub Msg
subscriptions model =
    Sub.none  -- Or relevant subscriptions
```

**Wrapping Executor messages:**
```gren
type Msg
    = ExecutorMsg Executor.Msg
    | StdinReceived (Result String String)
    | OutputWritten
    | SessionSaved (Result String {})

update : Msg -> Model -> { model : Model, command : Cmd Msg }
update msg model =
    when msg is
        ExecutorMsg executorMsg ->
            let
                result =
                    Executor.update
                        executorMsg
                        model.executor
                        model.config
                        { model = model.executor
                        , cmd = Cmd.none
                        , toMsg = ExecutorMsg
                        }
            in
            -- Handle state transitions...
```

**Executor state machine flow:**
```
Loading → AgentSpecLoaded → Validating
Validating → EnvironmentValidated → WaitingForSession
WaitingForSession → SessionCreated → Active
Active → MessageSent → Active (with tool calls) or Complete
Complete → output response, save session, exit
Failed → output error, exit 1
```

**Reading stdin in Gren:**
The program should read from `env.stdin` using `Stream.readAllAsString` or similar to get the initial JSON parameters.

## Testing Requirements

- Manual test: Run `echo '{"TASK_FILE":"tasks/example.md"}' | agent-executor agents/developer.md ./workspace`
- Verify conversation starts and completes
- Verify final response appears on stdout
- Verify session ID saved to `./workspace/.session`
- Verify error cases produce appropriate error messages on stderr

## Notes

- The Claude CLI provider handles tool execution internally, so the Executor's tool execution loop is not used
- The provider uses `-p` flag for non-interactive mode and `--output-format json` for parsing responses
- Initial parameters from stdin include TASK_FILE, STATUS_FILE, REPORT_FILE paths that become part of the system prompt or initial message
- The Config type for Executor includes provider, workspaceRoot, and fileToolsPath
- The Executor.update function takes a wrapper record for mapping Executor.Msg back to the parent Msg type
