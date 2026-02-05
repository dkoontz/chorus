- **Add an integration test for every scenario you test** - manual QA findings should become automated tests

## Writing Integration Tests

**For every test scenario you identify during QA, add a corresponding integration test.** This ensures all discovered cases—both successes and failures—become automated tests that can catch regressions.

### When to Add Tests

Add integration tests for:
- Each happy path scenario you verify
- Each edge case you discover (empty inputs, boundary values, etc.)
- Each error condition you test (invalid inputs, missing resources, etc.)
- Any case where including more context disambiguates duplicate matches
- Any case that fails validation (not found, not unique, etc.)

The goal is that every manual test you perform becomes an automated test in the suite.

### Test File Location

`src/tools/tests/integration/{tool-name}.json`

Each file contains scenarios for one tool (e.g., `file-read.json`, `file-write.json`).

### Schema

#### TestSuite (root object)

| Field       | Type            | Required | Description                   |
| ----------- | --------------- | -------- | ----------------------------- |
| `name`      | string          | yes      | Name of the tool being tested |
| `scenarios` | array<Scenario> | yes      | List of test scenarios        |

#### Scenario

| Field    | Type   | Required | Description                                      |
| -------- | ------ | -------- | ------------------------------------------------ |
| `name`   | string | yes      | Descriptive name for this test case              |
| `setup`  | Setup  | no       | Files to create before running the tool          |
| `input`  | any    | yes      | JSON passed directly to the tool (tool-specific) |
| `expect` | Expect | yes      | Expected results and assertions                  |

#### Setup

| Field   | Type                   | Required | Description                         |
| ------- | ---------------------- | -------- | ----------------------------------- |
| `files` | object<string, string> | no       | Map of file paths to their contents |

#### Expect

| Field             | Type                   | Required  | Description                                 |
| ----------------- | ---------------------- | --------- | ------------------------------------------- |
| `status`          | `"success"`            | `"error"` | yes                                         | Expected status based on presence of `error` field |
| `output`          | object<string, any>    | no        | Exact field value matches in response       |
| `output_contains` | object<string, string> | no        | Substring matches in response fields        |
| `error_contains`  | string                 | no        | Substring that must appear in error message |
| `files_exist`     | array<string>          | no        | Paths that must exist after tool runs       |
| `files_not_exist` | array<string>          | no        | Paths that must not exist after tool runs   |
| `file_content`    | object<string, string> | no        | Map of paths to their expected contents     |

### Example

```json
{
  "name": "file.patch",
  "scenarios": [
    {
      "name": "Apply patch with startLine",
      "setup": {
        "files": {
          "code.js": "line1\nline2\nline1"
        }
      },
      "input": {
        "tool": "file.patch",
        "path": "code.js",
        "patches": [
          {
            "find": "line1",
            "replace": "REPLACED",
            "startLine": 3
          }
        ]
      },
      "expect": {
        "status": "success",
        "output": {
          "success": true,
          "patches_applied": 1
        },
        "file_content": {
          "code.js": "line1\nline2\nREPLACED"
        }
      }
    }
  ]
}
```

### Running Tests

After adding tests, verify they pass:

```bash
cd src/tools
npm run test:integration
```

Run all tests (unit + integration):

```bash
npm run test:all
```

## Integration Tests Added

Document in your report each test scenario added to the integration test suite:

| Test Name          | File              | Validates               |
| ------------------ | ----------------- | ----------------------- |
| [Descriptive name] | `file-patch.json` | [What this test proves] |

If no tests were added, explain why.

## Testing in a browser

For tests that require viewing a webpage use your built-in Chrome tool to navigate to the website and test the feature(s).