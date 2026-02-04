/**
 * Unit tests for the Claude SDK client wrapper.
 */

import { describe, it } from "node:test";
import * as assert from "node:assert";
import { createClient, ClaudeSDKClient } from "./client.js";

describe("createClient", () => {
  it("should create a client instance", () => {
    const client = createClient("/path/to/file-tools");
    assert.ok(client instanceof ClaudeSDKClient);
  });
});

describe("ClaudeSDKClient", () => {
  describe("createSession", () => {
    it("should create a new session with a unique ID", async () => {
      const client = createClient("/path/to/file-tools");

      const result = await client.createSession(
        { name: "Test Agent", systemPrompt: "You are a test agent." },
        "/workspace"
      );

      assert.ok(result.sessionId, "Should return a session ID");
      assert.ok(
        result.sessionId.startsWith("sess_"),
        "Session ID should start with 'sess_'"
      );
    });

    it("should create unique session IDs", async () => {
      const client = createClient("/path/to/file-tools");

      const result1 = await client.createSession(
        { name: "Agent 1", systemPrompt: "First agent" },
        "/workspace1"
      );

      const result2 = await client.createSession(
        { name: "Agent 2", systemPrompt: "Second agent" },
        "/workspace2"
      );

      assert.notStrictEqual(
        result1.sessionId,
        result2.sessionId,
        "Session IDs should be unique"
      );
    });
  });

  describe("sendMessage", () => {
    it("should return a response for a valid session", async () => {
      const client = createClient("/path/to/file-tools");

      const session = await client.createSession(
        { name: "Test Agent", systemPrompt: "You are a test agent." },
        "/workspace"
      );

      const response = await client.sendMessage(
        session.sessionId,
        "Hello, agent!"
      );

      assert.ok(response.response, "Should have a response");
      assert.ok(Array.isArray(response.toolCalls), "Should have toolCalls array");
      assert.strictEqual(
        typeof response.isComplete,
        "boolean",
        "Should have isComplete boolean"
      );
    });

    it("should throw for an invalid session", async () => {
      const client = createClient("/path/to/file-tools");

      await assert.rejects(
        async () => client.sendMessage("invalid-session-id", "Hello"),
        /Session not found/
      );
    });
  });

  describe("submitToolResults", () => {
    it("should accept tool results for a valid session", async () => {
      const client = createClient("/path/to/file-tools");

      const session = await client.createSession(
        { name: "Test Agent", systemPrompt: "You are a test agent." },
        "/workspace"
      );

      // First send a message to create conversation history
      await client.sendMessage(session.sessionId, "Read a file");

      const response = await client.submitToolResults(session.sessionId, [
        { toolCallId: "call_123", output: '{"content": "file contents"}', isError: false },
      ]);

      assert.ok(response.response, "Should have a response");
      assert.ok(Array.isArray(response.toolCalls), "Should have toolCalls array");
    });

    it("should throw for an invalid session", async () => {
      const client = createClient("/path/to/file-tools");

      await assert.rejects(
        async () =>
          client.submitToolResults("invalid-session-id", [
            { toolCallId: "call_123", output: "result", isError: false },
          ]),
        /Session not found/
      );
    });
  });

  describe("resumeSession", () => {
    it("should return exists: true for an existing session", async () => {
      const client = createClient("/path/to/file-tools");

      const session = await client.createSession(
        { name: "Test Agent", systemPrompt: "You are a test agent." },
        "/workspace"
      );

      // Send a message to create history
      await client.sendMessage(session.sessionId, "Hello");

      const result = await client.resumeSession(session.sessionId);

      assert.strictEqual(result.exists, true, "Should indicate session exists");
      assert.strictEqual(
        result.agentName,
        "Test Agent",
        "Should return agent name"
      );
    });

    it("should return exists: false for a non-existent session", async () => {
      const client = createClient("/path/to/file-tools");

      const result = await client.resumeSession("non-existent-session");

      assert.strictEqual(result.exists, false, "Should indicate session does not exist");
    });
  });

  describe("getToolNames", () => {
    it("should return tool names", () => {
      const client = createClient("/path/to/file-tools");
      const names = client.getToolNames();

      assert.ok(Array.isArray(names), "Should return an array");
      assert.ok(names.length > 0, "Should have at least one tool");
    });
  });

  describe("getToolDefinitions", () => {
    it("should return tool definitions", () => {
      const client = createClient("/path/to/file-tools");
      const definitions = client.getToolDefinitions();

      assert.ok(typeof definitions === "object", "Should return an object");
      assert.ok("file.read" in definitions, "Should have file.read tool");
    });
  });
});
