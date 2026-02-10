# Open Questions

This document tracks decisions that need to be made before or during implementation. Items should be moved to the relevant documentation once resolved.

## Claude API Integration

- [ ] **SDK vs Direct API**: Should we use the Claude Code SDK to manage agent lifecycle, or call the Anthropic API directly?
  - Claude Code SDK: May provide conveniences for tool management and conversation handling
  - Direct API: More control, fewer dependencies, clearer understanding of what's happening
  - Need to investigate: What does the SDK provide that we can't easily do ourselves?

- [ ] **SDK Validation**: If using the SDK, how do we validate it supports our use case?
  - Can we intercept/wrap tool calls before execution?
  - Can we inject our custom tools instead of the built-in ones?
  - Can we run multiple agent instances concurrently?
  - How does context/conversation management work?

- [ ] **API Key Management**: How do we handle the Anthropic API key?
  - Stored in `/etc/chorus/secrets/` with other credentials?
  - Environment variable at container startup?
  - Per-agent keys for usage tracking?

- [ ] **Model Selection**: Which Claude model(s) should agents use?
  - Same model for all agents?
  - Configurable per-agent (e.g., smaller model for simple tasks)?
  - Cost implications?

## Agent Executor

- [ ] **Agent Definition Format**: How are user-created agents defined?
  - Markdown files with system prompt?
  - JSON/YAML configuration?
  - What metadata is needed? (name, description, allowed tools, etc.)

- [ ] **Tool Binding**: How does an agent get access to specific tools?
  - Whitelist in agent definition?
  - All agents get all tools?
  - Tool groups/categories?

- [ ] **Conversation Management**: How do we handle agent conversations?
  - How is conversation history stored?
  - When is context cleared or summarized?
  - How do we handle context window limits?

- [ ] **Agent Invocation**: How does the orchestrator start an agent?
  - Subprocess? In-process?
  - How are parameters passed?
  - How are results returned?

## Security

- [ ] **Reviewer Agent Design**: How does the reviewer agent detect malicious inputs?
  - What patterns indicate prompt injection?
  - Is it rule-based, ML-based, or LLM-based?
  - What's the false positive/negative tradeoff?
  - How do we update detection rules over time?

- [ ] **Secrets Encryption**: How are secrets encrypted at rest?
  - What encryption scheme?
  - Where is the decryption key stored?
  - How is key rotation handled?

- [ ] **Privilege Separation Implementation**: How do we implement the three-tier privilege model?
  - Separate Unix users?
  - Container isolation?
  - How does the tool runtime elevate privileges for secret access?

- [ ] **Audit Logging**: What security events should be logged?
  - Failed tool invocations?
  - Reviewer agent rejections?
  - All agent actions?

## XMPP Integration

- [ ] **Server Choice**: Prosody or ejabberd?
  - Which has better Gren/Node.js library support?
  - Self-hosted or external service?

- [ ] **Authentication**: How do users authenticate to the XMPP interface?
  - Standard XMPP accounts?
  - Integration with existing identity providers?
  - Single user or multi-user?

- [ ] **Message Format**: How are messages structured?
  - Plain text commands?
  - Structured format for complex requests?
  - How are task references handled?

- [ ] **Presence/Status**: How do we communicate agent status?
  - XMPP presence for orchestrator availability?
  - Status updates during long-running tasks?

## System Record

- [ ] **File Organization**: How are markdown records organized?
  - One file per task?
  - Append-only log files?
  - Directory structure?

- [ ] **Concurrency**: How do we handle concurrent writes?
  - File locking?
  - Single writer process?
  - Eventual consistency acceptable?

- [ ] **Retention**: How long are records kept?
  - Automatic cleanup?
  - Archival policy?

- [ ] **Querying**: How do agents find relevant history?
  - Full-text search?
  - Structured metadata?
  - Index files?

## Orchestrator

- [ ] **Routing Logic**: How does the orchestrator decide which agent handles a request?
  - Keyword matching?
  - LLM-based classification?
  - Explicit user selection?

- [ ] **Task Lifecycle**: What states can a task be in?
  - How are state transitions recorded?
  - What happens when a task fails?
  - Retry logic?

- [ ] **Agent Coordination**: How do agents hand off work?
  - Direct agent-to-agent communication?
  - Always through orchestrator?
  - How is context transferred?

## Tool Runtime

- [ ] **Error Reporting**: What information is included in error responses?
  - Stack traces (security concern)?
  - Detailed vs. generic messages?
  - Error codes for programmatic handling?

- [ ] **Rate Limiting**: Should tools have rate limits?
  - Prevent runaway agents?
  - Per-tool or global limits?

- [ ] **Timeouts**: How long can tool operations take?
  - Per-tool timeout configuration?
  - Global maximum?
  - How are long-running operations handled?

- [ ] **ripgrep Dependency**: What if ripgrep isn't available?
  - Graceful degradation to slower search?
  - Hard requirement?
  - Bundle ripgrep with the application?

## Deployment

- [ ] **Container Image**: What's the base image?
  - Node.js official image?
  - Alpine for size?
  - What system dependencies are needed?

- [ ] **Configuration**: How is Chorus configured?
  - Environment variables?
  - Configuration file?
  - What's configurable vs. hardcoded?

- [ ] **Monitoring**: How do we monitor a running Chorus instance?
  - Health check endpoint?
  - Metrics export (Prometheus)?
  - Log aggregation?

- [ ] **Backup/Restore**: How do we backup Chorus data?
  - What needs to be backed up? (records, secrets, agent definitions)
  - Restore procedure?

## Future Considerations

These don't need immediate answers but should be kept in mind:

- [ ] **Web Dashboard**: Technology choices when we build it
- [ ] **Multi-tenancy**: Supporting multiple users/organizations
- [ ] **Plugin System**: Allowing third-party tools
- [ ] **Horizontal Scaling**: Running multiple Chorus instances
