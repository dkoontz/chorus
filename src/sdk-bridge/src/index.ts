/**
 * SDK Bridge - TypeScript wrapper for Claude Code SDK integration.
 *
 * This module provides the interface between the Gren agent executor
 * and the Claude Code SDK. It exports functions that can be called
 * from Gren Task ports.
 *
 * Usage from JavaScript/Gren initialization:
 *
 * ```javascript
 * import { createTaskPorts } from 'chorus-sdk-bridge';
 *
 * const taskPorts = createTaskPorts({
 *   fileToolsPath: './src/tools/build/file-tools'
 * });
 *
 * Gren.Main.init({ taskPorts });
 * ```
 */

import { ClaudeSDKClient, createClient } from "./client.js";
import type {
  CreateSessionInput,
  CreateSessionOutput,
  SendMessageInput,
  SendMessageOutput,
  SubmitToolResultsInput,
  ResumeSessionInput,
  ResumeSessionOutput,
  ToolResult,
} from "./types.js";

// Re-export types for consumers
export type {
  AgentSpec,
  CreateSessionInput,
  CreateSessionOutput,
  SendMessageInput,
  SendMessageOutput,
  SubmitToolResultsInput,
  ResumeSessionInput,
  ResumeSessionOutput,
  ToolCall,
  ToolResult,
  MCPToolSchema,
} from "./types.js";

export { toolDefinitions, executeTool, getToolNames, isValidTool } from "./tools.js";
export { ClaudeSDKClient, createClient } from "./client.js";

/**
 * Configuration for creating task ports.
 */
export interface TaskPortsConfig {
  fileToolsPath: string;
}

/**
 * Task ports interface for Gren initialization.
 */
export interface TaskPorts {
  createSession: (input: CreateSessionInput) => Promise<string>;
  sendMessage: (input: SendMessageInput) => Promise<string>;
  submitToolResults: (input: SubmitToolResultsInput) => Promise<string>;
  resumeSession: (input: ResumeSessionInput) => Promise<string>;
}

/**
 * Create task ports for Gren initialization.
 *
 * These async functions are called by the Gren runtime when
 * Task ports are executed. They return JSON strings that are
 * parsed by the Gren code.
 */
export function createTaskPorts(config: TaskPortsConfig): TaskPorts {
  const client = createClient(config.fileToolsPath);

  return {
    /**
     * Create a new session with an agent.
     */
    async createSession(input: CreateSessionInput): Promise<string> {
      try {
        const result = await client.createSession(
          input.agentSpec,
          input.workspaceRoot
        );
        return JSON.stringify(result);
      } catch (error) {
        throw createPortError(error);
      }
    },

    /**
     * Send a message in a session.
     */
    async sendMessage(input: SendMessageInput): Promise<string> {
      try {
        const result = await client.sendMessage(input.sessionId, input.message);
        return JSON.stringify(result);
      } catch (error) {
        throw createPortError(error);
      }
    },

    /**
     * Submit tool results and get the next response.
     */
    async submitToolResults(input: SubmitToolResultsInput): Promise<string> {
      try {
        const result = await client.submitToolResults(
          input.sessionId,
          input.results
        );
        return JSON.stringify(result);
      } catch (error) {
        throw createPortError(error);
      }
    },

    /**
     * Resume an existing session.
     */
    async resumeSession(input: ResumeSessionInput): Promise<string> {
      try {
        const result = await client.resumeSession(input.sessionId);
        return JSON.stringify(result);
      } catch (error) {
        throw createPortError(error);
      }
    },
  };
}

/**
 * Error codes for structured error handling.
 */
type ErrorCode = "auth" | "rate_limit" | "network" | "session_not_found" | "invalid_response" | "unknown";

/**
 * Classify an error to determine its error code.
 */
function classifyError(error: unknown): ErrorCode {
  if (!(error instanceof Error)) {
    return "unknown";
  }

  const message = error.message.toLowerCase();

  // Check for session not found errors first (most specific)
  if (message.includes("session not found")) {
    return "session_not_found";
  }

  // Check for authentication errors
  if (message.includes("unauthorized") || message.includes("authentication") || message.includes("api key")) {
    return "auth";
  }

  // Check for rate limiting
  if (message.includes("rate limit") || message.includes("too many requests") || message.includes("429")) {
    return "rate_limit";
  }

  // Check for network errors
  if (message.includes("network") || message.includes("econnrefused") || message.includes("timeout") || message.includes("fetch failed")) {
    return "network";
  }

  return "unknown";
}

/**
 * Create a port error object for Gren consumption.
 *
 * The error is JSON encoded so Gren can decode it on the other side.
 * Includes a structured error code for reliable error classification.
 */
function createPortError(error: unknown): Error {
  const message = error instanceof Error ? error.message : String(error);
  const code = classifyError(error);

  // Return a JSON object that Gren can decode
  // The code field enables reliable error classification without string parsing
  const errorObj = { error: message, code };
  return new Error(JSON.stringify(errorObj));
}

/**
 * Default export for convenience.
 */
export default {
  createTaskPorts,
  createClient,
  toolDefinitions: () => import("./tools.js").then((m) => m.toolDefinitions),
};
