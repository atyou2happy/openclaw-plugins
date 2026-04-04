# openharness-commands

Slash commands from OpenHarness: `/oh-status`, `/oh-summary`, `/oh-compact`, `/oh-usage`, `/oh-cost`, `/oh-skills`, `/oh-hooks`, `/oh-memory`, `/oh-resume`, `/oh-session`, `/oh-export`, `/oh-permissions`, `/oh-plan`, `/oh-model`, `/oh-doctor`, `/oh-diff`, `/oh-branch`, `/oh-commit`.

## Overview

This plugin registers a comprehensive set of slash commands that give users direct access to OpenHarness functionality from within the OpenClaw chat interface. Commands cover status reporting, session management, git operations, and system diagnostics.

## Commands

| Command | Description |
|---------|-------------|
| `/oh-status` | Show current agent and session status |
| `/oh-summary` | Generate a summary of the current session |
| `/oh-compact` | Compact the conversation context |
| `/oh-usage` | Display token usage statistics |
| `/oh-cost` | Show estimated cost for the session |
| `/oh-skills` | List available skills |
| `/oh-hooks` | List active governance hooks |
| `/oh-memory` | View or manage persistent memory |
| `/oh-resume` | Resume a previous session |
| `/oh-session` | Show session information |
| `/oh-export` | Export the current conversation |
| `/oh-permissions` | Show current permission settings |
| `/oh-plan` | Enter or view planning mode |
| `/oh-model` | View or switch the current model |
| `/oh-doctor` | Run diagnostics and health checks |
| `/oh-diff` | Show git diff of current changes |
| `/oh-branch` | Manage git branches |
| `/oh-commit` | Create a git commit with auto-generated message |

## Configuration

This plugin has no configuration options. Commands are registered automatically when the plugin loads.

## Usage

Type any command in the OpenClaw chat:

```
/oh-status
/oh-doctor
/oh-cost
/oh-commit -m "feat: add user authentication"
```

## Project

Part of the [OpenHarness](https://github.com/openclaw/openharness) plugin ecosystem for OpenClaw.
