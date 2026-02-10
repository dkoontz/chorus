# File Tools Specification

The file tools provide sandboxed file system operations for agents. All operations are scoped to a designated workspace directory.

## Security

- All paths are validated to be within the workspace before any operation
- Path traversal attacks (using `..`) are rejected
- The workspace root is configured at runtime, not by the agent
- Tools return errors rather than exceptions for invalid operations

## Tools

### file.read

Read file contents with optional pagination for large files.

**Input:**
```json
{
  "path": "string",       // Required. Relative to workspace root
  "offset": "number",     // Optional. Start line, 1-indexed (default: 1)
  "limit": "number"       // Optional. Max lines to return (default: all)
}
```

**Output:**
```json
{
  "content": "string",      // File contents with line numbers
  "total_lines": "number",  // Total lines in file
  "truncated": "boolean"    // True if output was limited
}
```

**Errors:**
- `file_not_found` - File does not exist
- `path_outside_workspace` - Path escapes workspace directory
- `is_directory` - Path is a directory, not a file

---

### file.write

Create or overwrite a file. Creates parent directories if needed.

**Input:**
```json
{
  "path": "string",     // Required. Relative to workspace root
  "content": "string"   // Required. Full file contents
}
```

**Output:**
```json
{
  "success": "boolean",
  "bytes_written": "number"
}
```

**Errors:**
- `path_outside_workspace` - Path escapes workspace directory
- `write_failed` - I/O error during write

---

### file.patch

Apply search-and-replace edits to a file. More efficient than rewriting entire files for small changes.

**Input:**
```json
{
  "path": "string",         // Required. Relative to workspace root
  "patches": [              // Required. Array of patches to apply in order
    {
      "find": "string",     // Exact text to find (must be unique)
      "replace": "string"   // Text to replace it with
    }
  ]
}
```

**Output:**
```json
{
  "success": "boolean",
  "patches_applied": "number"
}
```

**Errors:**
- `file_not_found` - File does not exist
- `path_outside_workspace` - Path escapes workspace directory
- `find_not_found` - The find string was not found in the file
- `find_not_unique` - The find string matches multiple locations

**Example:**
```json
{
  "path": "src/config.py",
  "patches": [
    {
      "find": "DEBUG = True",
      "replace": "DEBUG = False"
    },
    {
      "find": "def connect():\n    return db.connect(timeout=30)",
      "replace": "def connect():\n    return db.connect(timeout=60, retry=3)"
    }
  ]
}
```

---

### file.delete

Delete a file. Does not delete directories.

**Input:**
```json
{
  "path": "string"    // Required. Relative to workspace root
}
```

**Output:**
```json
{
  "success": "boolean"
}
```

**Errors:**
- `file_not_found` - File does not exist
- `path_outside_workspace` - Path escapes workspace directory
- `is_directory` - Path is a directory (use a separate tool for directory deletion)

---

### file.list

List files in a directory with optional glob pattern filtering.

**Input:**
```json
{
  "path": "string",     // Optional. Directory relative to workspace (default: root)
  "pattern": "string"   // Optional. Glob pattern (e.g., "**/*.ts", "*.py")
}
```

**Output:**
```json
{
  "files": [
    {
      "path": "string",       // Path relative to workspace
      "size": "number",       // Size in bytes
      "modified": "string"    // ISO 8601 timestamp
    }
  ]
}
```

**Errors:**
- `path_outside_workspace` - Path escapes workspace directory
- `not_a_directory` - Path exists but is not a directory

---

### file.search

Search for content within files using regex patterns. Uses ripgrep internally for performance.

**Input:**
```json
{
  "pattern": "string",          // Required. Regex pattern
  "path": "string",             // Optional. Directory to search (default: workspace root)
  "glob": "string",             // Optional. Filter by filename pattern (e.g., "*.py")
  "case_sensitive": "boolean",  // Optional. Default: true
  "context_lines": "number",    // Optional. Lines before/after match (default: 0)
  "max_results": "number"       // Optional. Limit results (default: 100)
}
```

**Output:**
```json
{
  "matches": [
    {
      "path": "string",     // File path relative to workspace
      "line": "number",     // Line number (1-indexed)
      "content": "string"   // Matching line(s) with context
    }
  ],
  "truncated": "boolean"    // True if max_results was reached
}
```

**Errors:**
- `path_outside_workspace` - Path escapes workspace directory
- `invalid_pattern` - Regex pattern is invalid
- `ripgrep_not_found` - ripgrep binary not available (graceful degradation TBD)

**Example:**
```json
{
  "pattern": "def\\s+connect",
  "glob": "**/*.py",
  "context_lines": 2
}
```

**Response:**
```json
{
  "matches": [
    {
      "path": "src/db/connection.py",
      "line": 42,
      "content": "    # Establish database connection\n--> def connect(host, port):\n        return Client(host, port)"
    }
  ],
  "truncated": false
}
```

## Error Response Format

All errors are returned as structured JSON, not exceptions:

```json
{
  "error": "string",      // Error code (e.g., "file_not_found")
  "message": "string"     // Human-readable description
}
```

This allows agents to understand and respond to errors programmatically.
