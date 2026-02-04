/**
 * Claude Code SDK client wrapper.
 *
 * This module wraps the Claude Code SDK to provide session management
 * and tool execution for the Gren agent executor.
 */

import { randomUUID } from "crypto";
import type {
  AgentSpec,
  CreateSessionOutput,
  SendMessageOutput,
  ResumeSessionOutput,
  ToolCall,
  ToolResult,
} from "./types.js";
import { executeTool, toolDefinitions, getToolNames } from "./tools.js";

/**
 * Session state stored in memory.
 */
interface SessionState {
  id: string;
  agentSpec: AgentSpec;
  workspaceRoot: string;
  fileToolsPath: string;
  messages: Message[];
  pendingToolCalls: ToolCall[];
}

interface Message {
  role: "user" | "assistant";
  content: string;
  toolCalls?: ToolCall[];
  toolResults?: ToolResult[];
}

/**
 * In-memory session storage.
 * In production, this would be persisted to disk or a database.
 */
const sessions = new Map<string, SessionState>();

/**
 * SDK client for Claude Code integration.
 *
 * Note: The actual Claude Code SDK integration is stubbed here.
 * In a real implementation, this would use the @anthropic-ai/claude-code package.
 */
export class ClaudeSDKClient {
  private fileToolsPath: string;

  constructor(fileToolsPath: string) {
    this.fileToolsPath = fileToolsPath;
  }

  /**
   * Create a new conversation session.
   */
  async createSession(
    agentSpec: AgentSpec,
    workspaceRoot: string
  ): Promise<CreateSessionOutput> {
    const sessionId = `sess_${randomUUID()}`;

    const session: SessionState = {
      id: sessionId,
      agentSpec,
      workspaceRoot,
      fileToolsPath: this.fileToolsPath,
      messages: [],
      pendingToolCalls: [],
    };

    sessions.set(sessionId, session);

    return { sessionId };
  }

  /**
   * Send a message in an existing session.
   *
   * This is where the Claude Code SDK would be called. For now, this is
   * a stub that demonstrates the expected interface.
   */
  async sendMessage(
    sessionId: string,
    message: string
  ): Promise<SendMessageOutput> {
    const session = sessions.get(sessionId);
    if (!session) {
      throw new Error(`Session not found: ${sessionId}`);
    }

    // Add user message to history
    session.messages.push({
      role: "user",
      content: message,
    });

    // TODO: In a real implementation, this would:
    // 1. Build the conversation context from session.messages
    // 2. Include session.agentSpec.systemPrompt as the system prompt
    // 3. Register tools from toolDefinitions
    // 4. Call the Claude Code SDK
    // 5. Parse the response for text and tool calls

    // For now, return a stub response indicating the SDK needs to be integrated
    const stubResponse: SendMessageOutput = {
      response:
        "Claude Code SDK integration pending. " +
        `Received message in session ${sessionId}: "${message.substring(0, 100)}..."`,
      toolCalls: [],
      isComplete: true,
    };

    // Add assistant response to history
    session.messages.push({
      role: "assistant",
      content: stubResponse.response,
      toolCalls: stubResponse.toolCalls,
    });

    return stubResponse;
  }

  /**
   * Submit tool results and continue the conversation.
   */
  async submitToolResults(
    sessionId: string,
    results: ToolResult[]
  ): Promise<SendMessageOutput> {
    const session = sessions.get(sessionId);
    if (!session) {
      throw new Error(`Session not found: ${sessionId}`);
    }

    // Add tool results to the last message
    const lastMessage = session.messages[session.messages.length - 1];
    if (lastMessage) {
      lastMessage.toolResults = results;
    }

    // TODO: In a real implementation, this would:
    // 1. Submit the tool results to the Claude Code SDK
    // 2. Get the next response (which may include more tool calls)
    // 3. Return the response

    // For now, return a stub response
    const stubResponse: SendMessageOutput = {
      response: `Received ${results.length} tool result(s). SDK integration pending.`,
      toolCalls: [],
      isComplete: true,
    };

    session.messages.push({
      role: "assistant",
      content: stubResponse.response,
    });

    return stubResponse;
  }

  /**
   * Resume an existing session.
   */
  async resumeSession(sessionId: string): Promise<ResumeSessionOutput> {
    const session = sessions.get(sessionId);

    if (!session) {
      return { exists: false };
    }

    const lastMessage = session.messages[session.messages.length - 1];

    return {
      exists: true,
      agentName: session.agentSpec.name,
      lastMessage: lastMessage?.content,
    };
  }

  /**
   * Execute a tool call.
   */
  async executeTool(
    sessionId: string,
    toolCall: ToolCall
  ): Promise<string> {
    const session = sessions.get(sessionId);
    if (!session) {
      throw new Error(`Session not found: ${sessionId}`);
    }

    return executeTool(
      session.fileToolsPath,
      session.workspaceRoot,
      toolCall
    );
  }

  /**
   * Get the available tool definitions.
   */
  getToolDefinitions(): typeof toolDefinitions {
    return toolDefinitions;
  }

  /**
   * Get tool names for registration.
   */
  getToolNames(): string[] {
    return getToolNames();
  }
}

/**
 * Create a new SDK client instance.
 */
export function createClient(fileToolsPath: string): ClaudeSDKClient {
  return new ClaudeSDKClient(fileToolsPath);
}
