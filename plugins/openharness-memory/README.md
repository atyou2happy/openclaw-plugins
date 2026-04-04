# openharness-memory

Persistent cross-session memory system. Project-specific memory stored as markdown files with MEMORY.md index. Compatible with OpenHarness memory format.

## Overview

This plugin provides a persistent memory system that survives across agent sessions. Memory is stored as markdown files per project, with a `MEMORY.md` index file that provides an overview of all stored knowledge. This enables agents to retain context about projects, preferences, and past decisions between conversations.

## Memory Structure

```
.memory/
├── MEMORY.md          # Index of all memory entries
├── project.md         # Project-specific knowledge
├── preferences.md     # User preferences and conventions
└── decisions.md       # Architectural decisions and rationale
```

## Configuration

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `enabled` | `boolean` | `true` | Enable the memory system |
| `maxFiles` | `number` | `5` | Maximum memory files to load into context |
| `maxEntrypointLines` | `number` | `200` | Maximum lines from MEMORY.md to include in prompt |

## Usage

```json
{
  "plugins": {
    "openharness-memory": {
      "enabled": true,
      "maxFiles": 10,
      "maxEntrypointLines": 300
    }
  }
}
```

### Memory File Format

Each memory file uses markdown format:

```markdown
# Project Conventions

- Use TypeScript strict mode
- Prefer functional components
- No inline styles
```

The `MEMORY.md` index file lists all available memory files with brief descriptions, allowing the agent to selectively load relevant memories.

## Project

Part of the [OpenHarness](https://github.com/openclaw/openharness) plugin ecosystem for OpenClaw.
