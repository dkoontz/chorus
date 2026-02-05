# Task Registry

## Summary

Implement a task registry module (`Task.Registry`) within the main Chorus application that manages the lifecycle and persistence of tasks. Tasks are the central unit of work - each user request becomes a task that can be tracked, queued, and displayed in a UI.

**Important:** The task registry is system-level infrastructure managed directly by the Chorus application. Agents do not have access to read or modify the registry - they only see their sandboxed workspace directory.

## Location

This module is part of the main Chorus application:

```
src/chorus/
├── src/
│   ├── Main.gren
│   ├── Task/
│   │   ├── Registry.gren    # This module
│   │   └── Queue.gren       # Message queue operations
│   └── ...
├── tests/
│   ├── unit/
│   │   ├── Main.gren
│   │   ├── RegistryTests.gren
│   │   └── QueueTests.gren
│   └── integration/
│       ├── Main.gren
│       └── RegistryScenarios.gren
├── gren.json
└── package.json
```

## Data Model

### Task

```gren
type alias Task =
    { id : String                    -- GUID (e.g., "a1b2c3d4-e5f6-...")
    , title : String                 -- human-readable title
    , status : TaskStatus
    , createdAt : Time.Posix
    , updatedAt : Time.Posix
    , sessionId : Maybe String       -- Claude session ID if started
    , source : SourceInfo            -- originating chat/user
    , agentWorkspace : String        -- path to agent's sandboxed workspace
    }

type TaskStatus
    = Pending                        -- created but session not started
    | Active                         -- session is currently processing
    | Waiting                        -- session idle, ready for more input
    | Completed                      -- finished successfully
    | Failed String                  -- finished with error message

type alias SourceInfo =
    { sourceType : String            -- "terminal", "xmpp", "discord"
    , userId : String                -- who initiated this
    , conversationId : Maybe String  -- thread/channel for replies
    }
```

### Message Queue

```gren
type alias QueuedMessage =
    { id : String
    , content : String
    , receivedAt : Time.Posix
    }
```

### Event (for history)

```gren
type alias Event =
    { timestamp : Time.Posix
    , eventType : String             -- "created", "message_received", "response", etc.
    , data : Dict String String      -- event-specific data
    }
```

## File Structure

The task registry is stored separately from agent workspaces. Agents cannot access this directory.

```
{registry-root}/                     -- system directory (e.g., /var/chorus/tasks/)
├── registry.json                    -- index of all tasks
└── {guid}/                          -- per-task directory (GUID-named)
    ├── task.json                    -- task state
    ├── queue.json                   -- pending messages
    └── history.json                 -- event log

{workspaces-root}/                   -- agent workspace directory (separate)
└── {guid}/                          -- per-task agent workspace
    └── ...                          -- files agents can access
```

### registry.json

Lightweight index for fast loading. Contains summary info only.

```json
{
  "version": 1,
  "tasks": [
    {
      "id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
      "title": "Schedule lunch with Thomas",
      "status": "active",
      "createdAt": "2024-02-04T10:30:00Z",
      "updatedAt": "2024-02-04T10:32:00Z"
    }
  ]
}
```

### task.json

Full task state.

```json
{
  "id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "title": "Schedule lunch with Thomas",
  "status": "active",
  "createdAt": "2024-02-04T10:30:00Z",
  "updatedAt": "2024-02-04T10:32:00Z",
  "sessionId": "claude-session-xyz",
  "source": {
    "sourceType": "terminal",
    "userId": "david",
    "conversationId": null
  },
  "agentWorkspace": "/var/chorus/workspaces/a1b2c3d4-e5f6-7890-abcd-ef1234567890"
}
```

### queue.json

Messages waiting to be sent to the agent session.

```json
{
  "messages": [
    {
      "id": "msg-uuid-here",
      "content": "Actually make it Thursday instead",
      "receivedAt": "2024-02-04T10:31:00Z"
    }
  ]
}
```

### history.json

Structured event log. Each event has a type and associated data.

```json
{
  "events": [
    {
      "timestamp": "2024-02-04T10:30:00Z",
      "eventType": "task_created",
      "data": {
        "title": "Schedule lunch with Thomas"
      }
    },
    {
      "timestamp": "2024-02-04T10:30:05Z",
      "eventType": "session_started",
      "data": {
        "sessionId": "claude-session-xyz"
      }
    },
    {
      "timestamp": "2024-02-04T10:30:05Z",
      "eventType": "message_sent",
      "data": {
        "content": "Is there a good day to have lunch with Thomas this week?"
      }
    },
    {
      "timestamp": "2024-02-04T10:31:00Z",
      "eventType": "message_queued",
      "data": {
        "content": "Actually make it Thursday instead"
      }
    },
    {
      "timestamp": "2024-02-04T10:32:00Z",
      "eventType": "response_received",
      "data": {
        "content": "Checking Thomas's calendar..."
      }
    }
  ]
}
```

## API

### Registry Module

```gren
module Task.Registry exposing
    ( Registry
    , Task
    , TaskStatus(..)
    , SourceInfo
    , init
    , createTask
    , getTask
    , updateTask
    , updateStatus
    , listTasks
    , getActiveTasks
    , getRecentTasks
    , recordEvent
    )

{-| Initialize registry from disk. Creates directories if needed. -}
init :
    FileSystem.Permission
    -> Crypto.SecureContext
    -> { registryRoot : String, workspacesRoot : String }
    -> Task (Result Error Registry)

{-| Create a new task. Generates GUID, creates directories, initializes files. -}
createTask :
    Registry
    -> { title : String, source : SourceInfo }
    -> Task (Result Error { registry : Registry, task : Task })

{-| Get a task by ID (loads from task.json if not cached) -}
getTask : Registry -> String -> Task (Result Error (Maybe Task))

{-| Update task fields -}
updateTask :
    Registry
    -> String
    -> (Task -> Task)
    -> Task (Result Error Registry)

{-| Convenience: update just the status -}
updateStatus :
    Registry
    -> String
    -> TaskStatus
    -> Task (Result Error Registry)

{-| List all tasks, optionally filtered by status -}
listTasks : Registry -> Maybe TaskStatus -> Array Task

{-| Get currently active tasks (status = Active) -}
getActiveTasks : Registry -> Array Task

{-| Get recent tasks (last N, ordered by updatedAt) -}
getRecentTasks : Registry -> Int -> Array Task

{-| Record an event to the task's history.json -}
recordEvent :
    Registry
    -> String
    -> { eventType : String, data : Dict String String }
    -> Task (Result Error Registry)
```

### Queue Module

```gren
module Task.Queue exposing
    ( enqueue
    , dequeue
    , peek
    , isEmpty
    , length
    )

{-| Add message to task's queue -}
enqueue :
    Registry
    -> String
    -> String
    -> Task (Result Error Registry)

{-| Remove and return next message from queue -}
dequeue :
    Registry
    -> String
    -> Task (Result Error { registry : Registry, message : Maybe QueuedMessage })

{-| Look at next message without removing -}
peek : Registry -> String -> Task (Result Error (Maybe QueuedMessage))

{-| Check if task has queued messages -}
isEmpty : Registry -> String -> Task (Result Error Bool)

{-| Count queued messages -}
length : Registry -> String -> Task (Result Error Int)
```

## Requirements

### Functional Requirements

- [ ] Create new tasks with GUID-based unique IDs
- [ ] Persist task state to disk as JSON (survives restart)
- [ ] Update task status through lifecycle
- [ ] Queue messages for tasks (FIFO)
- [ ] Dequeue messages when task is ready
- [ ] List tasks by status (for UI and triage)
- [ ] Get recent tasks (for triage context)
- [ ] Record structured events to history.json
- [ ] Create corresponding agent workspace directory

### Non-Functional Requirements

- [ ] File operations are atomic (write to temp, then rename)
- [ ] Always read from disk (no in-memory caching for v1)
- [ ] Single-writer assumed (no concurrent access handling needed for v1)
- [ ] Task IDs are GUIDs for uniqueness and isolation
- [ ] Clear separation: registry files are system-only, workspaces are agent-accessible

## Implementation Notes

### Task ID Generation

Use `Crypto.randomUuidV4` from `gren-lang/core`:
```gren
import Crypto exposing (SecureContext)

-- SecureContext should be obtained once at app startup
generateTaskId : SecureContext -> Task x String
generateTaskId secureContext =
    Crypto.randomUuidV4 secureContext
```

The `SecureContext` is obtained via `Crypto.getSecureContext` during app initialization and passed through the registry.

### Directory Creation

On task creation:
1. Generate GUID
2. Create `{registryRoot}/{guid}/` with task.json, queue.json, history.json
3. Create `{workspacesRoot}/{guid}/` for agent workspace
4. Update registry.json index

### Atomic File Writes

Write to temp file, then rename:
```gren
writeAtomic : String -> String -> Task (Result Error {})
writeAtomic path content =
    let
        tempPath = path ++ ".tmp"
    in
    writeFile tempPath content
        |> Task.andThen (\_ -> renameFile tempPath path)
```

### History Events

Append new events to the events array in history.json. Common event types:
- `task_created`
- `session_started`
- `message_sent`
- `message_queued`
- `message_dequeued`
- `response_received`
- `status_changed`
- `task_completed`
- `task_failed`

## Testing

### Unit Tests (`tests/unit/`)

Test pure functions and JSON serialization using `gren-lang/test`:

- `RegistryTests.gren` - Task JSON encoding/decoding, status transitions
- `QueueTests.gren` - QueuedMessage JSON encoding/decoding

```gren
-- Example: Test Task JSON round-trip
testTaskSerialization =
    let
        task = { id = "abc-123", title = "Test", status = Pending, ... }
        json = encodeTask task |> Encode.encode 0
        decoded = Decode.decodeString taskDecoder json
    in
    Expect.equal (Ok task) decoded
```

### Integration Tests (`tests/integration/`)

A small Gren program that exercises the module against actual files:

```gren
-- tests/integration/Main.gren
main =
    Node.defineSimpleProgram init

init env =
    Init.await FileSystem.initialize <| \fsPermission ->
    Init.await Crypto.getSecureContext <| \secureContext ->
        let
            tempDir = "/tmp/chorus-test-" ++ timestamp
        in
        runAllScenarios fsPermission secureContext tempDir
            |> Task.andThen (reportResults env)
            |> Task.execute
```

### Scenarios to Cover

| Scenario | What it tests |
|----------|---------------|
| Create task | Directory creation, file writing, registry.json update |
| Get task | File reading, JSON parsing |
| Update status | File modification, atomic writes |
| Queue enqueue/dequeue | FIFO ordering, file updates |
| Record event | Append to history.json |
| List by status | Filtering works correctly |
| Recent tasks | Ordering by updatedAt |
| Restart recovery | Load existing tasks from disk |
| Missing task | Returns Nothing, doesn't crash |
| Corrupt JSON | Returns Error, doesn't crash |

## Dependencies

- `gren-lang/core` - Core types, `Crypto.randomUuidV4` for UUID generation
- `gren-lang/node` - FileSystem operations

## Acceptance Criteria

- [ ] Can create tasks with GUID IDs
- [ ] Task directories created in both registry and workspace roots
- [ ] Tasks persist across application restarts
- [ ] Task status transitions work correctly
- [ ] Message queue works correctly (FIFO)
- [ ] History events are recorded as structured JSON
- [ ] Active/recent task queries work for triage
- [ ] Agent workspace is separate from registry storage
