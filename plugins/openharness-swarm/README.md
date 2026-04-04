# openharness-swarm

Multi-agent coordination system: subagent spawning, team registry, task delegation, background task lifecycle, and ClawTeam-style coordination patterns from OpenHarness.

## Overview

This plugin enables OpenClaw agents to coordinate multiple AI agents working in parallel. It provides tools for spawning subagents, creating teams, delegating tasks, and managing the full lifecycle of background agent execution.

## Capabilities

- **Subagent Spawning**: Create isolated agent instances with their own context
- **Team Registry**: Organize agents into named teams with shared goals
- **Task Delegation**: Assign work to specific agents or teams
- **Background Task Lifecycle**: Create, monitor, and stop long-running tasks
- **Concurrency Control**: Limit the number of simultaneously running agents

## Configuration

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `maxConcurrentAgents` | `number` | `5` | Maximum number of concurrent subagents |
| `defaultAgentMode` | `string` | `"local_agent"` | Default mode: `local_agent`, `remote_agent`, or `in_process_teammate` |
| `agentTimeoutMs` | `number` | `300000` | Default timeout for subagent execution (5 minutes) |

## Usage

```json
{
  "plugins": {
    "openharness-swarm": {
      "maxConcurrentAgents": 10,
      "defaultAgentMode": "local_agent",
      "agentTimeoutMs": 600000
    }
  }
}
```

### Example: Spawning a Subagent

```
oh_agent_spawn({
  prompt: "Review the code in src/ for potential bugs",
  mode: "local_agent",
  timeoutMs: 120000
})
```

### Example: Creating a Team

```
oh_team_create({
  name: "review-team",
  members: ["agent-1", "agent-2"],
  goal: "Review all PRs in the queue"
})
```

## Project

Part of the [OpenHarness](https://github.com/openclaw/openharness) plugin ecosystem for OpenClaw.
