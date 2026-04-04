#!/usr/bin/env bash
# sync-plugins.sh — Deploy plugins to a native Linux path for OpenClaw.
#
# OpenClaw blocks plugins under /mnt/g/ (NTFS mount) via path_world_writable
# security check (Rule 41). This script syncs built plugins to a native path.
#
# Usage:
#   ./scripts/sync-plugins.sh                    # defaults to ~/openclaw-plugins
#   ./scripts/sync-plugins.sh /opt/openclaw-plugins  # custom target
#
# Prerequisites:
#   - Run `npm run build` first to compile TypeScript
#
# After sync, configure OpenClaw to load plugins from the target path:
#   plugins:
#     allow:
#       - ~/openclaw-plugins/plugins/*

set -euo pipefail

SOURCE_DIR="$(cd "$(dirname "$0")/.." && pwd)"
TARGET_DIR="${1:-$HOME/openclaw-plugins}"

if [ ! -d "$SOURCE_DIR/plugins" ]; then
  echo "ERROR: plugins/ directory not found in $SOURCE_DIR" >&2
  exit 1
fi

if [ ! -d "$SOURCE_DIR/dist" ] && [ ! -d "$SOURCE_DIR/plugins/dev-workflow/dist" ]; then
  echo "WARNING: No dist/ found. Run 'npm run build' first." >&2
fi

mkdir -p "$TARGET_DIR/plugins"

echo "Syncing plugins:"
echo "  Source: $SOURCE_DIR"
echo "  Target: $TARGET_DIR"

rsync -av --delete \
  --exclude='node_modules' \
  --exclude='.git' \
  --exclude='*.test.ts' \
  --exclude='tests' \
  --exclude='.DS_Store' \
  "$SOURCE_DIR/plugins/" \
  "$TARGET_DIR/plugins/"

# Copy root package.json and lockfile for workspace resolution
cp "$SOURCE_DIR/package.json" "$TARGET_DIR/package.json"
cp "$SOURCE_DIR/package-lock.json" "$TARGET_DIR/package-lock.json" 2>/dev/null || true
cp "$SOURCE_DIR/tsconfig.json" "$TARGET_DIR/tsconfig.json" 2>/dev/null || true

echo ""
echo "Done. Plugins synced to: $TARGET_DIR"
echo ""
echo "Add to your OpenClaw config:"
echo "  plugins:"
echo "    allow:"
echo "      - $TARGET_DIR/plugins/*"
