/**
 * Unit tests for MCP tool definitions and execution.
 */

import { describe, it } from "node:test";
import * as assert from "node:assert";
import { toolDefinitions, getToolNames, isValidTool } from "./tools.js";

describe("toolDefinitions", () => {
  it("should define all expected tools", () => {
    const expectedTools = [
      "file.read",
      "file.write",
      "file.patch",
      "file.delete",
      "file.list",
      "file.search",
    ];

    for (const toolName of expectedTools) {
      assert.ok(
        toolName in toolDefinitions,
        `Expected tool ${toolName} to be defined`
      );
    }
  });

  it("should have valid schemas for each tool", () => {
    for (const [name, schema] of Object.entries(toolDefinitions)) {
      assert.ok(schema.description, `Tool ${name} should have a description`);
      assert.ok(schema.inputSchema, `Tool ${name} should have an input schema`);
      assert.strictEqual(
        schema.inputSchema.type,
        "object",
        `Tool ${name} input schema type should be "object"`
      );
      assert.ok(
        schema.inputSchema.properties,
        `Tool ${name} should have properties defined`
      );
    }
  });

  it("file.read should require path", () => {
    const schema = toolDefinitions["file.read"];
    assert.deepStrictEqual(schema.inputSchema.required, ["path"]);
  });

  it("file.write should require path and content", () => {
    const schema = toolDefinitions["file.write"];
    assert.deepStrictEqual(schema.inputSchema.required, ["path", "content"]);
  });

  it("file.patch should require path and patches", () => {
    const schema = toolDefinitions["file.patch"];
    assert.deepStrictEqual(schema.inputSchema.required, ["path", "patches"]);
  });

  it("file.delete should require path", () => {
    const schema = toolDefinitions["file.delete"];
    assert.deepStrictEqual(schema.inputSchema.required, ["path"]);
  });

  it("file.list should have optional properties", () => {
    const schema = toolDefinitions["file.list"];
    assert.strictEqual(schema.inputSchema.required, undefined);
  });

  it("file.search should require pattern", () => {
    const schema = toolDefinitions["file.search"];
    assert.deepStrictEqual(schema.inputSchema.required, ["pattern"]);
  });
});

describe("getToolNames", () => {
  it("should return all tool names", () => {
    const names = getToolNames();
    assert.ok(Array.isArray(names), "Should return an array");
    assert.strictEqual(names.length, 6, "Should have 6 tools");
    assert.ok(names.includes("file.read"));
    assert.ok(names.includes("file.write"));
    assert.ok(names.includes("file.patch"));
    assert.ok(names.includes("file.delete"));
    assert.ok(names.includes("file.list"));
    assert.ok(names.includes("file.search"));
  });
});

describe("isValidTool", () => {
  it("should return true for valid tools", () => {
    assert.strictEqual(isValidTool("file.read"), true);
    assert.strictEqual(isValidTool("file.write"), true);
    assert.strictEqual(isValidTool("file.search"), true);
  });

  it("should return false for invalid tools", () => {
    assert.strictEqual(isValidTool("invalid"), false);
    assert.strictEqual(isValidTool("file.unknown"), false);
    assert.strictEqual(isValidTool(""), false);
  });
});
