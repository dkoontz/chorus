/**
 * TypeScript types for communication with the Gren agent executor.
 *
 * These types mirror the JSON structures used by the Task ports.
 */

// Agent specification
export interface AgentSpec {
  name: string;
  systemPrompt: string;
}

// Session management
export interface CreateSessionInput {
  agentSpec: AgentSpec;
  workspaceRoot: string;
}

export interface CreateSessionOutput {
  sessionId: string;
}

// Message handling
export interface SendMessageInput {
  sessionId: string;
  message: string;
}

export interface SendMessageOutput {
  response: string;
  toolCalls: ToolCall[];
  isComplete: boolean;
}

// Tool calls
export interface ToolCall {
  id: string;
  name: string;
  input: Record<string, unknown>;
}

export interface ToolResult {
  toolCallId: string;
  output: string;
  isError: boolean;
}

export interface SubmitToolResultsInput {
  sessionId: string;
  results: ToolResult[];
}

// Session resumption
export interface ResumeSessionInput {
  sessionId: string;
}

export interface ResumeSessionOutput {
  exists: boolean;
  agentName?: string;
  lastMessage?: string;
}

// Errors
export interface ProviderError {
  error: string;
  code?: string;
}

// MCP Tool schemas
export interface MCPToolSchema {
  description: string;
  inputSchema: {
    type: "object";
    properties: Record<string, PropertySchema>;
    required?: string[];
  };
}

export interface PropertySchema {
  type: string;
  description?: string;
  items?: PropertySchema;
  properties?: Record<string, PropertySchema>;
}
