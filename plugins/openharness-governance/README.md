# openharness-governance

Multi-level permission modes, path-level rules, command deny lists, and PreToolUse/PostToolUse lifecycle hooks from OpenHarness.

## Overview

This plugin provides a comprehensive governance layer for OpenClaw agents, controlling what tools and commands agents can use, which paths they can access, and enforcing safety rules through lifecycle hooks.

## Permission Modes

| Mode | Behavior |
|------|----------|
| `default` | Ask before write/execute operations |
| `auto` | Allow all operations without prompting |
| `plan` | Block all write operations (read-only) |

## Hooks

| Hook | Description |
|------|-------------|
| `PreToolUse` | Intercepts tool calls before execution for permission checks |
| `PostToolUse` | Inspects tool results after execution for policy enforcement |

## Configuration

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `mode` | `string` | `"default"` | Permission mode: `default`, `auto`, or `plan` |
| `pathRules` | `object[]` | `[]` | Path-level permission rules with glob patterns |
| `deniedCommands` | `string[]` | `[]` | Commands that are always denied |
| `allowedTools` | `string[]` | `[]` | Explicitly allowed tools |
| `deniedTools` | `string[]` | `[]` | Explicitly denied tools |

## Usage

```json
{
  "plugins": {
    "openharness-governance": {
      "mode": "default",
      "pathRules": [
        { "pattern": "**/*.config.*", "allow": false },
        { "pattern": "src/**", "allow": true }
      ],
      "deniedCommands": ["rm -rf /", "DROP TABLE *", ":(){ :|:& };:"],
      "allowedTools": ["oh_bash", "oh_file_read", "oh_file_write"],
      "deniedTools": ["oh_remote_trigger"]
    }
  }
}
```

## Project

Part of the [OpenHarness](https://github.com/openclaw/openharness) plugin ecosystem for OpenClaw.
