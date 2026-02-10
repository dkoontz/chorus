# Chorus Architecture

## Overview

Chorus is a secure multi-agent system where agents operate autonomously but can only interact with the outside world through deterministic, sandboxed tools. The key principle is a rigid separation between the agent's decision to take action and the execution of those actions.

## Problem Statement

In typical agentic workflows, an agent is given access to command line tools through a Bash session. This means the agent could theoretically be tricked (via prompt injection) or decide incorrectly to do something dangerous such as:

- Send credentials to a malicious URL
- Execute destructive commands (`rm -rf /`)
- Overwrite system files in ways that compromise security

Restricting Bash commands is ineffective since agents often make small modifications to commands (adding environment variables, chaining with `;sleep 3`, etc.). It is currently impossible to have an agent that is both:

1. Incapable of executing commands that could damage the system
2. Able to run independently without user approval for tool usage

## Solution

Allow agents to run without needing permissions but in an environment where the only tools they have access to are specifically designed for agent use. These tools are:

- **Deterministic** - Same input always produces same behavior
- **Scoped** - Operations are restricted to allowed directories/hosts
- **Read-only** - Agents cannot modify the tools themselves
- **Secret-isolating** - Credentials are accessed inside tools, never exposed to agents

## Security Model

### Three Privilege Levels

```
┌─────────────────────────────────────────────────────────────┐
│                   PRIVILEGE LEVEL: ROOT                      │
│  /etc/chorus/secrets/          Secrets (encrypted at rest)   │
│  /opt/chorus/tools/            Tool executables (read-only)  │
│  /opt/chorus/agents/           Agent specifications          │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│              PRIVILEGE LEVEL: TOOL RUNTIME                   │
│  /var/chorus/records/          System record (markdown)      │
│     tasks/                     Task definitions, status      │
│     history/                   Agent handoffs, decisions     │
│     tool-failures/             Failed tool invocations       │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│              PRIVILEGE LEVEL: AGENT                          │
│  /var/chorus/workspaces/{id}/  Per-task scratch space        │
│     src/                       Cloned repos, files           │
│     output/                    Generated artifacts           │
└─────────────────────────────────────────────────────────────┘
```

### Security Properties

| Property | How It's Achieved |
|----------|-------------------|
| Tools cannot be modified by agents | Tools are owned by root, read-only to agent user |
| Agent specs cannot be modified | Specs are owned by root, read-only to agent user |
| Secrets are not exposed | Secrets stored in `/etc/chorus/secrets/`, accessed only by tool runtime |
| System record cannot be falsified | Records writable only by tool runtime, not agent process |
| File operations are scoped | Tools validate all paths are within workspace before operating |

### System Agent Protection

When an agent requests modifications to tools or other agent specs, the request flows through a security layer:

```
Agent Request → Reviewer Agent → [PASS] → System Agent → Execute
                     │
                     └── [MALICIOUS] → Stop Agent → Human Review
```

The reviewer agent:
- Accepts only structured data, not free-form text
- Validates requests against allowed patterns
- Detects potential prompt injection attempts
- Triggers human review if malicious input is suspected

## System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      XMPP Interface                          │
│                    (Prosody/ejabberd)                        │
└─────────────────────┬───────────────────────────────────────┘
                      │
┌─────────────────────▼───────────────────────────────────────┐
│                    Orchestrator Agent                        │
│         (routes requests, manages agent lifecycle)           │
└─────────────────────┬───────────────────────────────────────┘
                      │
        ┌─────────────┼─────────────┐
        ▼             ▼             ▼
   ┌─────────┐  ┌─────────┐  ┌─────────┐
   │ Agent A │  │ Agent B │  │ Agent N │   User-defined agents
   └────┬────┘  └────┬────┘  └────┬────┘
        │             │             │
        └─────────────┼─────────────┘
                      ▼
┌─────────────────────────────────────────────────────────────┐
│                    Tool Runtime (Gren)                       │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐       │
│  │  Files   │ │   HTTP   │ │   SSH    │ │   Cron   │  ...  │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘       │
└─────────────────────────────────────────────────────────────┘
                      │
┌─────────────────────▼───────────────────────────────────────┐
│                   System Record (Markdown)                   │
│     tasks/ │ history/ │ reports/ │ tool-failures/           │
└─────────────────────────────────────────────────────────────┘
```

## Components

| Component | Technology | Purpose |
|-----------|------------|---------|
| Tool Runtime | Gren → Node.js | Executes sandboxed tools with privilege separation |
| Agent Executor | Gren | Manages Claude API calls, tool invocation |
| System Record | Markdown files | Persists tasks, history, tool failures |
| XMPP Bridge | Gren | Connects chat interface to orchestrator |
| Web Dashboard | Gren (future) | Visual task management |

## Directory Conventions

| Path | Purpose |
|------|---------|
| `/opt/chorus/` | Application code (tools, agent specs) - read-only |
| `/etc/chorus/` | Configuration and secrets - root only |
| `/var/chorus/` | Runtime data (workspaces, records) - varies by subdirectory |

## Secrets Management

Secrets are stored in `/etc/chorus/secrets/` and organized by type:

```
/etc/chorus/secrets/
├── ssh/                    # SSH keys for configured hosts
├── api-keys/               # API keys indexed by service name
└── credentials.json        # General credentials (encrypted at rest)
```

**Access flow:**
1. Agent calls a tool (e.g., `ssh.exec`) with structured parameters
2. Tool runtime (privileged) looks up the required credential
3. Tool executes the operation using the credential
4. Agent receives only the operation result, never the credential

## Tool Design Principles

1. **JSON in, JSON out** - All tools accept and return structured JSON
2. **Validate before acting** - Check all parameters, especially paths, before any operation
3. **Fail with helpful errors** - Error messages should help an AI agent understand what went wrong
4. **Scope by default** - Operations default to the narrowest scope (e.g., workspace root)
5. **No shell execution** - Tools never pass agent input to a shell interpreter

## Target Environment

- **Production:** Linux (VPS or Docker container)
- **Development:** Linux or macOS
- **Language:** Gren (pure functional, compiles to Node.js)
