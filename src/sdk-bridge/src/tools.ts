/**
 * MCP tool definitions for file operations.
 *
 * These tools are registered with the Claude Code SDK and invoke
 * the file-tools binary for actual operations.
 */

import { spawn } from "child_process";
import type { MCPToolSchema, ToolCall } from "./types.js";

/**
 * Tool definitions that match the file-tools binary capabilities.
 */
export const toolDefinitions: Record<string, MCPToolSchema> = {
  "file.read": {
    description: "Read a file from the workspace",
    inputSchema: {
      type: "object",
      properties: {
        path: { type: "string", description: "Path relative to workspace" },
        offset: { type: "number", description: "Line to start from (optional)" },
        limit: { type: "number", description: "Max lines to read (optional)" },
      },
      required: ["path"],
    },
  },

  "file.write": {
    description: "Write content to a file in the workspace",
    inputSchema: {
      type: "object",
      properties: {
        path: { type: "string", description: "Path relative to workspace" },
        content: { type: "string", description: "Content to write" },
      },
      required: ["path", "content"],
    },
  },

  "file.patch": {
    description: "Apply find/replace patches to a file",
    inputSchema: {
      type: "object",
      properties: {
        path: { type: "string", description: "Path relative to workspace" },
        patches: {
          type: "array",
          items: {
            type: "object",
            properties: {
              find: { type: "string" },
              replace: { type: "string" },
              startLine: { type: "number" },
            },
          },
        },
      },
      required: ["path", "patches"],
    },
  },

  "file.delete": {
    description: "Delete a file from the workspace",
    inputSchema: {
      type: "object",
      properties: {
        path: { type: "string", description: "Path relative to workspace" },
      },
      required: ["path"],
    },
  },

  "file.list": {
    description: "List files in a directory",
    inputSchema: {
      type: "object",
      properties: {
        path: {
          type: "string",
          description: "Directory path (default: workspace root)",
        },
        pattern: { type: "string", description: "Glob pattern to filter files" },
      },
    },
  },

  "file.search": {
    description: "Search for a pattern in files using ripgrep",
    inputSchema: {
      type: "object",
      properties: {
        pattern: { type: "string", description: "Search pattern (regex)" },
        path: {
          type: "string",
          description: "Directory to search (default: workspace root)",
        },
        glob: { type: "string", description: "File glob pattern" },
        caseSensitive: {
          type: "boolean",
          description: "Case sensitive search (default: true)",
        },
        contextLines: {
          type: "number",
          description: "Lines of context around matches",
        },
        maxResults: {
          type: "number",
          description: "Maximum results (default: 100)",
        },
      },
      required: ["pattern"],
    },
  },
};

/**
 * Execute a tool by invoking the file-tools binary.
 *
 * @param fileToolsPath - Path to the file-tools binary
 * @param workspaceRoot - Root directory for file operations
 * @param toolCall - The tool call to execute
 * @returns Promise resolving to the tool output (JSON string)
 */
export async function executeTool(
  fileToolsPath: string,
  workspaceRoot: string,
  toolCall: ToolCall
): Promise<string> {
  const input = JSON.stringify({
    tool: toolCall.name,
    ...toolCall.input,
  });

  return new Promise((resolve, reject) => {
    const proc = spawn(fileToolsPath, [workspaceRoot, input], {
      stdio: ["ignore", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";

    proc.stdout.on("data", (data: Buffer) => {
      stdout += data.toString();
    });

    proc.stderr.on("data", (data: Buffer) => {
      stderr += data.toString();
    });

    proc.on("close", (code) => {
      if (code === 0) {
        resolve(stdout.trim());
      } else {
        // Try to parse error from stderr or stdout
        const errorOutput = stderr.trim() || stdout.trim();
        try {
          const errorJson = JSON.parse(errorOutput);
          reject(new Error(errorJson.error || "Tool execution failed"));
        } catch {
          reject(new Error(errorOutput || `Tool exited with code ${code}`));
        }
      }
    });

    proc.on("error", (err) => {
      reject(new Error(`Failed to spawn file-tools: ${err.message}`));
    });
  });
}

/**
 * Get the list of available tool names.
 */
export function getToolNames(): string[] {
  return Object.keys(toolDefinitions);
}

/**
 * Check if a tool name is valid.
 */
export function isValidTool(name: string): boolean {
  return name in toolDefinitions;
}
