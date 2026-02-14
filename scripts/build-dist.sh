#!/usr/bin/env bash
set -e

PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DIST="$PROJECT_ROOT/dist"

echo "Assembling dist/..." >&2

# Clean built artifacts only (preserve dist/data/)
rm -rf "$DIST/chorus" "$DIST/chorus-tools" "$DIST/static"

# Create directories
mkdir -p "$DIST/static"

# Copy binaries
cp "$PROJECT_ROOT/packages/chorus/build/chorus" "$DIST/chorus"
cp "$PROJECT_ROOT/packages/tools/build/chorus-tools" "$DIST/chorus-tools"

# Copy UI files
cp "$PROJECT_ROOT/packages/chorus-ui/build/app.js" "$DIST/static/"
cp "$PROJECT_ROOT/packages/chorus-ui/static/"* "$DIST/static/"

echo "dist/ assembled." >&2
