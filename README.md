# OpenClaw Plugins

OpenClaw plugin collection — multiple plugins in a single monorepo.

## Plugins

| Plugin | Description | Status |
|--------|-------------|--------|
| [dev-workflow](plugins/dev-workflow/) | Spec-driven AI development workflow with multi-agent orchestration | ✅ Active |
| [wechat](plugins/wechat/) | WeChat Official Account & WeCom (企业微信) channel support | ✅ Active |
| [openharness-tools](plugins/openharness-tools/) | 43+ OpenHarness tools bridged as OpenClaw agent tools (file I/O, shell, search, web, tasks, agents, cron) | ✅ Active |
| [openharness-skills](plugins/openharness-skills/) | Markdown-based on-demand skill loading, compatible with anthropics/skills format | ✅ Active |
| [openharness-governance](plugins/openharness-governance/) | Multi-level permissions, path rules, command deny lists, pre/post tool hooks | ✅ Active |
| [openharness-swarm](plugins/openharness-swarm/) | Multi-agent coordination: subagent spawning, team registry, task delegation, background lifecycle | ✅ Active |
| [openharness-memory](plugins/openharness-memory/) | Persistent cross-session memory with MEMORY.md index, project-specific storage, heuristic search | ✅ Active |
| [openharness-commands](plugins/openharness-commands/) | 20+ slash commands from OpenHarness: /oh-status, /oh-doctor, /oh-permissions, /oh-commit, etc. | ✅ Active |

## OpenHarness Integration Architecture

These 6 plugins bridge the full OpenHarness agent harness into OpenClaw:

```
OpenHarness Subsystem    →  OpenClaw Plugin
─────────────────────────────────────────────────
43+ Tools Registry       →  openharness-tools (agent tools via registerTool)
Skills System (.md)      →  openharness-skills (discovery + auto-inject via before_prompt_build)
Permissions + Hooks      →  openharness-governance (before_tool_call + after_tool_call hooks)
Multi-Agent Swarm        →  openharness-swarm (subprocess spawning + team registry)
Context & Memory         →  openharness-memory (MEMORY.md + project-specific storage)
Slash Commands           →  openharness-commands (registerCommand for 20+ commands)
```
| [openharness-tools](plugins/openharness-tools/) | 43+ OpenHarness tools bridged as OpenClaw agent tools (file I/O, shell, search, web, tasks, agents, cron) | ✅ Active |
| [openharness-skills](plugins/openharness-skills/) | Markdown-based on-demand skill loading, compatible with anthropics/skills format | ✅ Active |
| [openharness-governance](plugins/openharness-governance/) | Multi-level permissions, path rules, command deny lists, pre/post tool hooks | ✅ Active |
| [openharness-swarm](plugins/openharness-swarm/) | Multi-agent coordination: subagent spawning, team registry, task delegation, background lifecycle | ✅ Active |
| [openharness-memory](plugins/openharness-memory/) | Persistent cross-session memory with MEMORY.md index, project-specific storage, heuristic search | ✅ Active |
| [openharness-commands](plugins/openharness-commands/) | 20+ slash commands from OpenHarness: /oh-status, /oh-doctor, /oh-permissions, /oh-commit, etc. | ✅ Active |

## OpenHarness Integration Architecture

These 6 plugins bridge the full OpenHarness agent harness into OpenClaw:

```
OpenHarness Subsystem    →  OpenClaw Plugin
─────────────────────────────────────────────────
43+ Tools Registry       →  openharness-tools (agent tools via registerTool)
Skills System (.md)      →  openharness-skills (discovery + auto-inject via before_prompt_build)
Permissions + Hooks      →  openharness-governance (before_tool_call + after_tool_call hooks)
Multi-Agent Swarm        →  openharness-swarm (subprocess spawning + team registry)
Context & Memory         →  openharness-memory (MEMORY.md + project-specific storage)
Slash Commands           →  openharness-commands (registerCommand for 20+ commands)
```

## Quick Start

```bash
# Install dependencies for all plugins
npm install

# Build all plugins
npm run build

# Run tests for all plugins
npm run test

# Type check all plugins
npm run typecheck
```

## Plugin Development

Each plugin lives in `plugins/<name>/` with its own:
- `package.json` — plugin metadata and dependencies
- `openclaw.plugin.json` — OpenClaw plugin manifest
- `src/` — source code
- `tests/` — test files
- `skills/` — (optional) skill files for the plugin

### Adding a New Plugin

1. Create `plugins/<new-plugin>/` directory
2. Copy the structure from an existing plugin
3. Update `package.json` name and metadata
4. Update `openclaw.plugin.json` with plugin-specific config
5. Run `npm install` at the root to link workspaces

## Channel Compatibility

| Plugin | CLI | Feishu | WeChat |
|--------|-----|--------|--------|
| dev-workflow | ✅ Tools + Hooks | ✅ Tools available to LLM agent | ✅ Tools available to LLM agent |
| wechat | — | — | ✅ Full channel support |
| openharness-tools | ✅ 43+ tools | ✅ All tools via LLM agent | ✅ All tools via LLM agent |
| openharness-skills | ✅ Skill discovery + auto-inject | ✅ Auto-inject on prompt build | ✅ Auto-inject on prompt build |
| openharness-governance | ✅ Hooks + permissions tool | ✅ Hooks on all tool calls | ✅ Hooks on all tool calls |
| openharness-swarm | ✅ Subagent spawn/manage | ✅ Via LLM agent tools | ✅ Via LLM agent tools |
| openharness-memory | ✅ Memory CRUD + auto-inject | ✅ Auto-inject on prompt build | ✅ Auto-inject on prompt build |
| openharness-commands | ✅ 20+ slash commands | ✅ Via command handler | ✅ Via command handler |

dev-workflow registers its tools (DevWorkflowTool, WorkflowStatusTool, TaskExecuteTool, SpecViewTool, QAGateTool) via the OpenClaw plugin API. These tools are available to the LLM agent across **all channels** — Feishu, WeChat, and CLI — once the plugin is loaded.

## Deployment (WSL / NTFS Mount)

Plugins under `/mnt/g/` (Windows NTFS mounts) are blocked by OpenClaw's `path_world_writable` security check. Use the sync script to deploy to a native Linux path:

```bash
# Build first
npm run build

# Sync to default target (~/openclaw-plugins)
./scripts/sync-plugins.sh

# Or specify a custom target
./scripts/sync-plugins.sh /opt/openclaw-plugins
```

Then configure OpenClaw to load plugins from the target path:

```yaml
plugins:
  allow:
    - ~/openclaw-plugins/plugins/*
```

## License

MIT
