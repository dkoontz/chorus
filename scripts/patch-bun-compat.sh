#!/usr/bin/env bash
#
# Patches Gren-compiled JS for Bun binary compatibility.
#
# In a Bun-compiled binary, the Gren runtime uses `module.filename` for
# `env.applicationPath`, which returns only the original source filename
# (e.g., "chorus.js") instead of the full binary path. This script replaces
# that expression with `process.execPath`, which correctly returns the
# absolute path to the compiled binary.
#
# Usage: scripts/patch-bun-compat.sh <file.js>

set -e

FILE="$1"

if [ -z "$FILE" ] || [ ! -f "$FILE" ]; then
    echo "Usage: $0 <file.js>" >&2
    exit 1
fi

# Replace the Gren runtime's applicationPath resolution.
# Before: typeof module !== "undefined" ? module.filename : process.execPath
# After:  process.execPath
#
# In Bun-compiled binaries, process.execPath returns the absolute path to
# the running binary, which is what we need for resolving sibling directories
# (static/, data/, tools/).
sed -i '' 's/typeof module !== "undefined" ? module\.filename : process\.execPath/process.execPath/' "$FILE"

# Verify the patch was applied
if grep -q 'module\.filename' "$FILE"; then
    echo "Warning: module.filename still present in $FILE after patching" >&2
    exit 1
fi

echo "Patched $FILE for Bun compatibility" >&2
