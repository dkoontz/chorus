- [ ] Move sub-projects out of /src so we don't have /src/project/src
- [ ] We need to capture the output of each agent in the chain working on a task. Each agent also needs its own permissions, so we won't be using Claude sub-agents but instead be handing data back and forth via a tool call like `hand-off-to-agent <agent-name> <Prompt to be given to agent>. The output of an agent would then be handed back, although we probably should only send the last message back to the calling agent, the intermediate thinking/tool calling is not relevant.
- [ ] Agents are continuing to use find, grep, pgrep instead of fd, ripgrep. Update the pre-tool call hook to reject these as well with instructions to use the appropriate utilities.

