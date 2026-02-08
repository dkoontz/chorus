# Chorus Main Application

## Summary

The main Chorus application coordinates message flow between external sources (XMPP, Terminal, Discord, etc.) and Claude-powered agents. It manages concurrent tasks, routes messages via a triage agent, and provides the foundation for a task-based UI.

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    Source Interface                          │
│   (Terminal, XMPP, Discord, Signal, etc.)                   │
└─────────────────────────┬───────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│                     Triage Agent                             │
│   - Classifies: new task vs. follow-up vs. command          │
│   - Routes to appropriate task                               │
└─────────────────────────┬───────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│                    Task Registry                             │
│   - Manages task lifecycle                                   │
│   - Persists task state                                      │
│   - Queues messages for busy tasks                          │
└─────────────────────────┬───────────────────────────────────┘
                          │
        ┌─────────────────┼─────────────────┐
        ▼                 ▼                 ▼
   ┌─────────┐       ┌─────────┐       ┌─────────┐
   │ Task 1  │       │ Task 2  │       │ Task N  │
   │(session)│       │(session)│       │(session)│
   └─────────┘       └─────────┘       └─────────┘
        │                 │                 │
        └─────────────────┴─────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│                 Response Formatter                           │
│   - Tags responses with task context                        │
│   - Routes back to originating source                       │
└─────────────────────────────────────────────────────────────┘
```

## Implementation Phases

### Phase 1: Task Registry (`tasks/task-registry.md`)
- Task data model and persistence
- Task lifecycle management (create, update status, complete)
- Message queue per task
- File-based storage in `/var/chorus/tasks/` (or configurable path)

### Phase 2: Triage Agent (`tasks/triage-agent.md`)
- Lightweight agent that classifies incoming messages
- Decides: new task, route to existing task, or handle as command
- Uses task registry to see active/recent tasks
- Fast response time (< 2 seconds ideally)

### Phase 3: Message Router (`tasks/message-router.md`)
- Connects triage decisions to task registry actions
- Manages session lifecycle (start, resume, queue)
- Handles responses and routes back to source
- Coordinates concurrent task execution

### Phase 4: Source Interface (`tasks/source-interface.md`)
- Abstract interface for message sources
- Terminal implementation (first, for testing)
- XMPP implementation
- Future: Discord, Signal, etc.

### Phase 5: Main Application (`tasks/chorus-app.md`)
- Wires everything together
- Configuration and startup
- Graceful shutdown
- Error handling and recovery

## Directory Structure

```
src/chorus/
├── src/
│   ├── Main.gren              # Application entry point
│   ├── Task/
│   │   ├── Registry.gren      # Task lifecycle and persistence
│   │   └── Queue.gren         # Message queue operations
│   ├── Triage.gren            # Message classification agent
│   ├── Router.gren            # Routes messages to tasks
│   └── Source/
│       ├── Source.gren        # Source interface definition
│       └── Terminal.gren      # Terminal implementation
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

## Relationship to Existing Code

| Existing                 | Role in Main App                           |
| ------------------------ | ------------------------------------------ |
| `src/agent-executor/`    | Used by tasks to run orchestrator sessions |
| `Provider.ClaudeCode`    | LLM backend for orchestrator and triage    |
| `src/tools/`             | File tools available to agents             |
| `agents/orchestrator.md` | System prompt for task sessions            |

## Key Design Decisions

1. **Tasks are first-class entities** - Every user request becomes a task with persistent state

2. **Triage before routing** - All messages go through triage to determine intent

3. **Session per task** - Each task has its own Claude session for context isolation

4. **Queue when busy** - Messages for active tasks are queued, not dropped

5. **Source-agnostic** - Core logic doesn't know about XMPP vs Terminal vs Discord

## Out of Scope (for now)

- Multi-user / authentication
- Privilege separation (security model)
- Horizontal scaling
