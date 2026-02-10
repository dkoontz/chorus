#!/usr/bin/env bash
set -e

PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DIST="$PROJECT_ROOT/dist"

echo "Assembling dist/..." >&2

# Clean built artifacts only (preserve dist/data/)
rm -rf "$DIST/chorus" "$DIST/static" "$DIST/tools"

# Create directories
mkdir -p "$DIST/static" "$DIST/tools"

# Copy chorus binary
cp "$PROJECT_ROOT/packages/chorus/build/chorus" "$DIST/chorus"

# Copy UI files
cp "$PROJECT_ROOT/packages/chorus-ui/build/app.js" "$DIST/static/"
cp "$PROJECT_ROOT/packages/chorus-ui/static/"* "$DIST/static/"

# Copy all tool binaries (wildcard, not a hardcoded list)
for bin in "$PROJECT_ROOT/packages/tools/build/"*; do
    [ -f "$bin" ] && [ -x "$bin" ] && cp "$bin" "$DIST/tools/"
done

echo "dist/ assembled." >&2
