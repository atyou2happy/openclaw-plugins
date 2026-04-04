# openharness-skills

On-demand markdown skill loading system compatible with the Anthropic Skills format. Skills are loaded contextually when the agent needs domain-specific guidance.

## Overview

This plugin provides a skill discovery and loading mechanism for OpenClaw agents. Skills are markdown files that contain specialized instructions, workflows, and tool integrations. They are loaded automatically when keyword patterns match the conversation, or on-demand when the agent determines a skill is needed.

## How It Works

1. Skills are stored as `.md` files with a `SKILL.md` entry point
2. The plugin indexes all available skills at startup
3. Skills are loaded into context when:
   - The user explicitly requests a skill
   - Keyword patterns in `autoLoadPatterns` match the conversation
   - The agent determines a skill is relevant to the task

## Skills Directory

Skills are loaded from:

- `skills/` (bundled with the plugin)
- Any directories specified in `skillDirs` config

## Configuration

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `skillDirs` | `string[]` | `[]` | Additional directories to scan for skill `.md` files |
| `autoLoadPatterns` | `string[]` | `[]` | Keyword patterns that trigger automatic skill loading |

## Usage

```json
{
  "plugins": {
    "openharness-skills": {
      "skillDirs": ["/path/to/my/skills", "~/.openclaw/skills"],
      "autoLoadPatterns": ["presentation", "spreadsheet", "PDF", "design"]
    }
  }
}
```

### Skill File Format

Skills follow the Anthropic Skills convention:

```markdown
---
name: my-skill
description: Does something useful
---

# My Skill

Instructions and workflows for the agent...
```

## Project

Part of the [OpenHarness](https://github.com/openclaw/openharness) plugin ecosystem for OpenClaw.
