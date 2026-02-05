# Task Registry Web Interface

## Summary

Build a full-featured web interface for testing task creation and displaying task statuses. The interface provides real-time visibility into the Task Registry with the ability to create tasks, update statuses, view event history, and inspect message queues.

**Architecture**: All-Gren implementation using `HttpServer` from gren-lang/node for the backend and gren-lang/browser for the frontend.

## Progress

### Completed

(None yet)

### In Progress

(None yet)

### Not Started

- [ ] Phase 1: Backend HTTP Server
- [ ] Phase 2: API Endpoints
- [ ] Phase 3: Static File Serving
- [ ] Phase 4: Frontend Application
- [ ] Phase 5: Real-Time Polling
- [ ] Phase 6: Polish

## Architecture

```
Browser (Gren Browser App)     HTTP      Gren Node Backend
┌─────────────────────────┐    ←→    ┌─────────────────────────┐
│ Dashboard / Task List   │          │ HttpServer (port 8080)  │
│ Task Detail / History   │          │ Web.Router / Web.Api    │
│ Queue View              │          │ Task.Registry (existing)│
│ Polling every 2s        │          │ Task.Queue (existing)   │
└─────────────────────────┘          └─────────────────────────┘
```

## API Endpoints

| Method | Path | Handler | Description |
|--------|------|---------|-------------|
| GET | /api/tasks | listTasks | List all tasks (optional ?status= filter) |
| GET | /api/tasks/:id | getTask | Get single task |
| POST | /api/tasks | createTask | Create new task |
| PUT | /api/tasks/:id/status | updateStatus | Update task status |
| GET | /api/tasks/:id/history | getHistory | Get event history |
| GET | /api/tasks/:id/queue | getQueue | Inspect message queue |
| POST | /api/tasks/:id/queue | enqueue | Add message to queue |
| GET | /* | static files | Serve frontend assets |

## File Structure

```
src/chorus/
├── src/
│   ├── Main.gren              # Modified: HTTP server entry point
│   ├── Task/
│   │   ├── Registry.gren      # Existing (no changes)
│   │   └── Queue.gren         # Existing (no changes)
│   └── Web/
│       ├── Server.gren        # NEW: HttpServer setup
│       ├── Router.gren        # NEW: URL routing
│       ├── Api.gren           # NEW: API handlers
│       └── Static.gren        # NEW: Static file serving
├── static/                    # NEW: Frontend build output
│   └── (compiled JS, CSS)
└── package.json               # Add build scripts

src/chorus-ui/                 # NEW: Frontend project
├── gren.json                  # Browser platform
├── src/
│   ├── Main.gren              # Browser.application entry
│   ├── Api.gren               # HTTP client
│   ├── Model.gren             # State types
│   ├── Route.gren             # URL routing
│   └── View/
│       ├── Dashboard.gren     # Overview with stats
│       ├── TaskList.gren      # Filterable list
│       ├── TaskDetail.gren    # Single task view
│       └── History.gren       # Event timeline
├── static/
│   └── index.html             # HTML shell
└── build/
    └── app.js                 # Compiled output
```

## Implementation Phases

### Phase 1: Backend HTTP Server

Create the HTTP server infrastructure:

1. **Web.Server module**
   - Initialize HttpServer permission with `HttpServer.initialize`
   - Create server with `HttpServer.createServer`
   - Configure host/port (default: localhost:8080)

2. **Web.Router module**
   - Parse URL paths
   - Extract path parameters (e.g., `:id`)
   - Match routes to handlers

3. **Update Main.gren**
   - Change from SimpleProgram to full `Node.Program`
   - Use `Init.await` for FileSystem, Crypto, HttpServer permissions
   - Initialize Task.Registry
   - Wire up `HttpServer.onRequest` subscription

### Phase 2: API Endpoints

Implement REST API handlers in `Web.Api`:

1. **GET /api/tasks** - Call `Registry.listTasks`, apply optional status filter
2. **GET /api/tasks/:id** - Call `Registry.getTask`, handle not-found
3. **POST /api/tasks** - Parse JSON body, call `Registry.createTask`
4. **PUT /api/tasks/:id/status** - Parse status, call `Registry.updateStatus`
5. **GET /api/tasks/:id/history** - Read history.json from task directory
6. **Queue endpoints** - Integrate `Task.Queue` functions

Response format:
```json
{
  "data": { ... },
  "meta": { "timestamp": 1707048600000 }
}
```

### Phase 3: Static File Serving

Create `Web.Static` module:

1. Map URL paths to filesystem paths in `static/` directory
2. Read files using FileSystem
3. Set Content-Type headers based on extension (.html, .js, .css)
4. Return 404 for missing files
5. Serve index.html for SPA routes (fallback)

### Phase 4: Frontend Application

Create new `src/chorus-ui/` project:

1. **Project setup**
   - Create gren.json with browser platform
   - Add gren-lang/browser dependency

2. **Main.gren**
   - Use `Browser.application` for SPA with routing
   - Handle onUrlRequest / onUrlChange

3. **Api.gren**
   - HTTP client functions for each API endpoint
   - JSON decoders matching backend response format

4. **Views**
   - Dashboard: Task counts by status, recent activity
   - TaskList: Filterable list with status badges
   - TaskDetail: Full task info, history timeline, queue inspection
   - History: Event timeline with timestamps

### Phase 5: Real-Time Polling

Implement near-real-time updates via polling:

1. **Frontend subscriptions**
   ```gren
   subscriptions model =
       Time.every 2000 (\_ -> PollTasks)
   ```

2. **Smart updates**
   - Compare fetched data with current state
   - Only update UI when data changes
   - Show subtle loading indicator during poll

3. **Optimistic updates**
   - When user changes status, update UI immediately
   - Confirm on next poll

### Phase 6: Polish

1. **Error handling**
   - Display API errors to user
   - Retry logic for failed requests
   - Connection status indicator

2. **Styling**
   - Status-based colors (Pending=gray, Active=blue, Completed=green, Failed=red)
   - Clean, professional design
   - Responsive layout

3. **Build integration**
   - npm scripts for building frontend
   - Copy compiled output to static directory

## Dependencies

### Backend (existing - no changes needed)

```json
{
  "dependencies": {
    "direct": {
      "gren-lang/core": "7.0.0",
      "gren-lang/node": "6.1.0"
    }
  }
}
```

gren-lang/node 6.1.0 includes HttpServer module.

### Frontend (new project)

```json
{
  "type": "application",
  "platform": "browser",
  "gren-version": "0.6.3",
  "dependencies": {
    "direct": {
      "gren-lang/core": "7.0.0",
      "gren-lang/browser": "4.0.0"
    }
  }
}
```

## Existing Code to Reuse

| Module | Functions | Purpose |
|--------|-----------|---------|
| Task.Registry | `encodeTask`, `taskDecoder` | JSON serialization |
| Task.Registry | `listTasks`, `getTask`, `createTask`, `updateStatus` | Core operations |
| Task.Registry | `recordEvent` | History recording |
| Task.Queue | `enqueue`, `peek`, `length` | Queue operations |
| agent-executor/Main.gren | Full Program pattern | Reference for structure |

## Requirements

### Functional Requirements

- [ ] Create tasks via web form
- [ ] Display task list with status filtering
- [ ] View single task details
- [ ] Update task status via UI
- [ ] View task event history
- [ ] Inspect message queue
- [ ] Add messages to queue
- [ ] Real-time updates (within 2 seconds)

### Non-Functional Requirements

- [ ] All-Gren implementation (no JavaScript wrappers)
- [ ] Clean, usable interface
- [ ] Graceful error handling
- [ ] Works on localhost for development

## Acceptance Criteria

- [ ] Backend serves HTTP on configurable port
- [ ] All API endpoints return valid JSON
- [ ] Frontend loads and displays task list
- [ ] Can create a task through the UI
- [ ] Task status changes reflect in UI within 2 seconds
- [ ] History view shows event timeline
- [ ] Queue inspection works correctly
- [ ] Static files served correctly (JS, CSS, HTML)

## Testing

1. **Backend API tests**
   - Start server, make HTTP requests, verify responses
   - Test each endpoint with valid and invalid inputs

2. **Integration test**
   - Create task via API
   - Verify appears in list
   - Update status, verify change
   - Check history recorded

3. **Manual UI testing**
   - Open browser to localhost:8080
   - Create task, observe in list
   - Click task, view details
   - Update status, verify real-time update
