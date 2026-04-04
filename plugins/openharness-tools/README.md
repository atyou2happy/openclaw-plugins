# openharness-tools

Bridges 43+ OpenHarness tools (file I/O, shell, search, web, MCP, tasks, agents) into OpenClaw agent tools.

## Overview

This plugin exposes the full suite of OpenHarness tools to OpenClaw agents, enabling them to perform file operations, execute shell commands, search code, fetch web content, connect to MCP servers, manage tasks, spawn subagents, and more.

## Tools

| Tool | Description |
|------|-------------|
| `oh_bash` | Execute shell commands |
| `oh_file_read` | Read file contents |
| `oh_file_write` | Write file contents |
| `oh_file_edit` | Apply targeted edits to files |
| `oh_glob` | Find files by glob pattern |
| `oh_grep` | Search file contents with regex |
| `oh_web_fetch` | Fetch content from a URL |
| `oh_web_search` | Perform web searches |
| `oh_tool_search` | Search available tools |
| `oh_skill` | Load a skill by name |
| `oh_config` | Read/write configuration |
| `oh_brief` | Generate brief summaries |
| `oh_sleep` | Pause execution |
| `oh_ask_user` | Prompt the user for input |
| `oh_todo_write` | Write/manage TODO lists |
| `oh_enter_plan_mode` | Enter planning mode |
| `oh_exit_plan_mode` | Exit planning mode |
| `oh_enter_worktree` | Enter a git worktree |
| `oh_exit_worktree` | Exit a git worktree |
| `oh_cron_create` | Create a scheduled job |
| `oh_cron_list` | List scheduled jobs |
| `oh_cron_delete` | Delete a scheduled job |
| `oh_remote_trigger` | Trigger a remote action |
| `oh_task_create` | Create a background task |
| `oh_task_get` | Get task details |
| `oh_task_list` | List all tasks |
| `oh_task_stop` | Stop a running task |
| `oh_task_output` | Get task output |
| `oh_task_update` | Update task state |
| `oh_agent_spawn` | Spawn a subagent |
| `oh_send_message` | Send a message to an agent |
| `oh_team_create` | Create a team of agents |
| `oh_team_delete` | Delete a team |
| `oh_notebook_edit` | Edit a notebook |
| `oh_lsp` | Interact with LSP servers |

## Configuration

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `allowedTools` | `string[]` | `[]` (all) | Subset of tools to expose (empty = all) |
| `mcpServers` | `object` | `{}` | MCP server configurations to connect to |

## Usage

```json
{
  "plugins": {
    "openharness-tools": {
      "allowedTools": ["oh_bash", "oh_file_read", "oh_file_write", "oh_grep"],
      "mcpServers": {
        "my-server": { "url": "http://localhost:3000/mcp" }
      }
    }
  }
}
```

## Project

Part of the [OpenHarness](https://github.com/openclaw/openharness) plugin ecosystem for OpenClaw.
