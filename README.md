# Chorus: Multi-Agent Development Workflow

A multi-agent system for Claude Code that coordinates development, code review, and QA through specialized agents communicating via shared workspace files.

## Quick Start

1. Define your task in `workspace/task.md`
2. Run the orchestrator agent:
   ```
   claude "Read agents/orchestrator.md and execute the workflow for the task in workspace/task.md"
   ```

## Architecture

```
chorus/
├── agents/                    # Agent prompt definitions
│   ├── developer.md          # Implements code changes
│   ├── developer-review.md   # Reviews code quality
│   ├── qa.md                 # Tests functionality
│   └── orchestrator.md       # Coordinates workflow
├── workspace/                 # Shared communication
│   ├── task.md               # Current task specification
│   ├── status.md             # Workflow status
│   └── reports/              # Agent outputs
│       ├── dev-report.md
│       ├── review-report.md
│       └── qa-report.md
└── README.md
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

## Defining a Task

Edit `workspace/task.md`:

```markdown
# Task: Add user logout button

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

## Running Individual Agents

You can run agents directly for debugging:

```bash
# Run developer only
claude "Read agents/developer.md and implement the task in workspace/task.md"

# Run review only
claude "Read agents/developer-review.md and review the changes in workspace/reports/dev-report.md"

# Run QA only
claude "Read agents/qa.md and test the implementation"
```

## Status Tracking

The orchestrator maintains `workspace/status.md` with:
- Current phase (dev, review, qa, complete)
- Iteration count
- History of agent actions

## Agent Reports

Each agent writes a structured report:

- **dev-report.md**: Files modified, build/test status, implementation notes
- **review-report.md**: Issues found (blocking vs suggestions), approval decision
- **qa-report.md**: Test scenarios, failures with reproduction steps, pass/fail decision

## Iteration Limits

The orchestrator stops after 5 iterations to prevent infinite loops. If the task cannot be completed, it reports the recurring issues.

## Customization

Modify the agent prompts in `agents/` to adjust:
- Review criteria
- Testing approach
- Report formats
- Workflow rules
