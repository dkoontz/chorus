<overview>
I am designing an application that allows a user to give unrestricted system access to an agent (so that it is never blocked by needing user approval for an action) but in a way that does not compromise the system in the event of a prompt injection attack or a hallucination. The key to this system is a rigid separation between the agent's decision to take action and the execution of those actions.
</overview>

<problem>
In a typical agentic workflow, an agent like Claude Code is given access to a variety of command line tools through a Bash session. This means the agent could theoretically be tricked to (or decide incorrectly to) do something dangerous such as send credentials to a URL, `sudo rm -rf /`, overwrite a system file in a way that compromises its security, etc. The power of an agent is that they can reason about what is the correct tool to use in a situation, but it is currently impossible to guarantee an agent will never misuse a tool. Restricting the Bash commands that can be run in ineffective since agents often make small modifications to a command, for eample adding a temporary environment variable, or adding `;sleep 3` to the end of a command or are using commands that cannot be easily sandboxed such as `rm`. It is therefore impossible to have an agent that is both a) incapable of executing commands that could damage the system AND b) able to run indepdently without needing to ask for user approval for tool usage. Running Claude Code with `--dangerously-skip-permissions` is not a realistic solution, neither is requiring a user to approve dozens or hundreds of small variations of tool usage.
</problem>

<proposed-solution>
Allow agents to run without needing any permissions but in an environment where the only tools they have access to are specifically designed for agent use. Different agents would only have access to specific tools. These tools are small applications that are fully deterministic and will guarantee that a "delete this directory" tool use can only be applied to the project directory the agent has access to. A failure in the tool usage indicates to the agent that it cannot `rm -rf /` even if it has been successfully tricked via prompt injection to think this is the correct course of action. In order to guarantee the integrity of the tools and the agents themselves there are a few requirements that must be in place.

- The tools must be runnable by the agent but only available as read only files that the agent has no ability to modify. This prevents a compromised agent from updating a tool to remove its restrictions and then running that tool.

- The files that define any of the agents participating in the system must also be read only. This prevents a compromised agent from being instructed to alter its own or another agent's system prompt and thereby alter its future behavior.

- Any secrets needed to interact with services are accessed entirely inside the tools. This prevents a compromised agent from divluging sensitive information.

It is still highly desirable that the agents have the autonomy to evolve the system. To this end a set of "agent tools" are available that allows agents to request changes to the system. These tools would take the request and when needed invoking an immutable system level agent that WOULD be allowed to create/edit tools or to modify the system prompt of an agent. This system level agent would need to be hardened against any sort of prompt injection attack carried out by a compromised agent using the tool.
</proposed-solution>

<ideas>
- Users can chat with the orchestrator which then decides which agents to delegate the work to. The orchestrator only has the tool that invokes a sub agent and sends it work.
  
- Trello board style web interface that would allow the user to enter new tasks and see their status as they are being worked on. These tasks are added to the system record.

- XMPP interface to converse with the top level orchestrator agent. 

- System record as markdown files or small sqlite style database
  - Tasks/projects the user has defined, this acts like a backlog of desired actions that can be reviewed by an agent and then handed off to be worked on
  - Records the handoff of work between sub-agents, what is communicated into/out of sub-agents
  - Records the status of each task being worked on
  - Records tool usage that fails for analysis by system agents to improve the tooling

Normal tools
  - File operations: search, create/delete files and directories, edit files.
  - HTTP requests
  - Web search
  - SSH/SCP
  - Adding/modifying a recurring task (cron job)

Agent support tools 
  - Notes, lets an agent create/edit a note that is associated with that specific agent and the current task. This is a record of the agent's thoughts if the task is so long running that the context needs to be cleared. This might also automatically include a log of the events that have taken such as the the handoff of work between agents. An agent's approach might differ if they know this is the 4th time the work has been rejected by the QA agent.
  - Agent task list/todo that is persisted outside of agent's context, contains a description of the task, goals, etc. to help an agent get reoriented if their context is cleared or compacted
  - Delegate work to a sub-agent. This would use the built-in Claude Task tool but after invoking a system app that records the fact that a sub-agent was used.
  - Add tool, edit tool. This allows an agent to request new tools such as access to a browser so that it can validate changes to a webpage or a tool to start/stop the application running in a background process so that the agent can test the app after recompiling.
</ideas>

<questions>
Can we use the Claude Code SDK so that our own custom application is in charge of the agent lifecycle? This allows us to put in checks and record keeping at various points in a way that is not so easy when everything is managed by a Claude Code session. It also makes feeding in messages from a XMPP connection much easier.
</questions>

I am sure I am overlooking a great many problems and issues but this is my initial thoughts on this project. Please help me refine this into a 