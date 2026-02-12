# Developer Report

## Task
Fix the bug where `file.search` returns an error instead of an empty matches array when no matches are found.

## Files Modified
- `/Users/david/dev/chorus/src/tools/src/Tools/File.gren` - Added `handleSearchError` function to distinguish between "no matches" (exit code 1) and actual errors (exit code 2+). Updated `searchWithRipgrep` and `searchWithGrep` to use this new error handler. Updated fallback logic in `search` to only fall back to grep when ripgrep is not available (not for all errors).

## Build Status
**Status:** PASS

```
$ gren make Main --output=file-tools.js
Compiling ...Success! Compiled 4 modules.
    Main ───> file-tools.js
```

## Test Status
**Status:** PASS

Unit tests: Exit code 0 (all 29 tests pass)

Manual verification:
- Search with no matches: `{"matches":[],"truncated":false}` (was: `{"error":"Search failed: grep failed"}`)
- Search with matches: Returns correct matches
- Search with invalid regex: Returns proper error message
- Grep fallback with no matches: Returns empty array correctly

## Implementation Notes

### Root Cause
Both ripgrep and grep exit with code 1 when no matches are found. The original code treated any non-zero exit code as a failure via `Task.mapError`, which converted all errors uniformly without distinguishing between "no matches" and actual errors.

### Fix Applied
Added a new helper function `handleSearchError` that examines the `FailedRun` type:

1. **`ProgramError` with exit code 1**: This means "no matches found" for both grep and ripgrep. Return an empty result: `{matches: [], truncated: false}`

2. **`ProgramError` with exit code 2+**: This indicates an actual error (invalid regex, permission denied, etc.). Extract the error message from stderr and return a `SearchFailed` error.

3. **`InitError`**: The command couldn't start (not installed, not in PATH). Return a "not available" error, which triggers the fallback to grep.

### Changes to Fallback Logic
Updated the main `search` function to only fall back to grep when the error contains "not available" (indicating ripgrep isn't installed). Previously, it would fall back on any error, which wasn't needed since the error handling now properly distinguishes between no-matches and real errors.

## Iteration
3
