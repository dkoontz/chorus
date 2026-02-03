# Chorus: Multi-Agent Development Workflow

A multi-agent system for Claude Code that coordinates development, code review, and QA through specialized agents.

## Quick Start

1. Create a task file in `tasks/`:
   ```bash
   cp tasks/example.md tasks/my-feature.md
   # Edit tasks/my-feature.md with your requirements
   ```

2. Run the orchestrator:
   ```
   claude "Read agents/orchestrator.md and execute the workflow.

   Parameters:
   TASK_FILE: tasks/my-feature.md"
   ```

The orchestrator automatically creates `workspaces/my-feature/` for status and reports.

## Architecture

```
chorus/
├── agents/                      # Agent prompt definitions
│   ├── developer.md            # Implements code changes
│   ├── developer-review.md     # Reviews code quality
│   ├── qa.md                   # Tests functionality
│   └── orchestrator.md         # Coordinates workflow
├── tasks/                       # Task definitions (one file per task)
│   ├── example.md
│   ├── feature-a.md
│   └── feature-b.md
└── workspaces/                  # Auto-created per task
    └── {task-name}/
        ├── status.md
        └── reports/
            ├── developer-1.md
            ├── review-1.md
            └── qa-1.md
```

## Workflow

```
Developer → Review → QA → Complete
    ↑         |       |
    └─────────┴───────┘
         (on failure)
```

1. **Developer** implements the requirements, runs build and tests
2. **Review** checks code quality and identifies issues
3. **QA** verifies functionality through testing
4. **Orchestrator** coordinates transitions and handles failures

## Task File Format

Create a markdown file in `tasks/` describing the work:

```markdown
# Add user logout button

## Requirements
- Add a logout button to the header component
- Clicking the button should clear the session and redirect to login

## Acceptance Criteria
- Button is visible when user is logged in
- Clicking button logs user out
- User is redirected to /login after logout

## Context
The header component is in src/components/Header.tsx.
Session management uses the useAuth hook.
```

The filename becomes the workspace name: `tasks/logout-button.md` → `workspaces/logout-button/`

## Running Multiple Tasks

Start separate Claude Code sessions, each with a different task:

```bash
# Terminal 1
claude "Read agents/orchestrator.md and execute the workflow.

Parameters:
TASK_FILE: tasks/feature-a.md"

# Terminal 2
claude "Read agents/orchestrator.md and execute the workflow.

Parameters:
TASK_FILE: tasks/feature-b.md"
```

Each task gets its own workspace directory, so they don't interfere.

## How Sub-Agents Work

The orchestrator uses Claude Code's built-in Task tool to spawn sub-agents:

```
Orchestrator (receives TASK_FILE)
    │
    ├── Derives workspace from task filename
    │
    ├── Task tool → Developer sub-agent
    │                 → writes developer-1.md, returns
    │
    ├── [reads developer-1.md, decides next step]
    │
    ├── Task tool → Review sub-agent
    │                 → writes review-1.md, returns
    │
    ├── [reads review-1.md, decides next step]
    │
    └── Task tool → QA sub-agent
                      → writes qa-1.md, returns
```

## Agent Reports

Reports are numbered by iteration to preserve history:

- **developer-{N}.md**: Files modified, build/test status, implementation notes
- **review-{N}.md**: Issues found (blocking vs suggestions), approval decision
- **qa-{N}.md**: Test scenarios, failures with reproduction steps, pass/fail decision

Example after 2 iterations:
```
workspaces/my-feature/reports/
├── developer-1.md   # Initial implementation
├── review-1.md      # Review found issues
├── developer-2.md   # Fixed review issues
├── review-2.md      # Approved
└── qa-2.md          # QA passed
```

## Running Individual Agents

For debugging, run agents directly:

```bash
# Run developer only
claude "Read agents/developer.md and execute your workflow.

Parameters:
TASK_FILE: tasks/my-feature.md
STATUS_FILE: workspaces/my-feature/status.md
REPORT_FILE: workspaces/my-feature/reports/developer-1.md"
```

## Iteration Limits

The orchestrator stops after 5 iterations to prevent infinite loops. If the task cannot be completed, it reports the recurring issues.

## Customization

Modify the agent prompts in `agents/` to adjust:
- Review criteria
- Testing approach
- Report formats
- Workflow rules
