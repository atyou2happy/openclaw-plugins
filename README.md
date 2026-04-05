# OpenClaw Plugins

OpenClaw plugin collection — multiple plugins in a single monorepo.

[中文文档](README_CN.md)

## Plugins

| Plugin | Description | Status |
|--------|-------------|--------|
| [openharness](plugins/openharness/) | 116+ tools in a unified plugin: file I/O, shell, search, web, git, GitHub, LSP, code intel, MCP, sessions, memory, swarm, REPL, cost tracking, and more | ✅ Active |
| [dev-workflow](plugins/dev-workflow/) | Spec-driven AI development workflow with multi-agent orchestration | ✅ Active |
| [cross-platform-message-sync](plugins/cross-platform-message-sync/) | Cross-platform message sync (WeChat/QQ/Feishu) | ✅ Active |
| [wechat](plugins/wechat/) | WeChat Official Account & WeCom (企业微信) channel support | ✅ Active |

## OpenHarness Modules

The `openharness` plugin consolidates 21 former sub-plugins into a single entry point:

| Module | Tools | Description |
|--------|-------|-------------|
| tools | 19 | File read/write/edit, glob, grep, bash, web search/fetch, skill loading, config, brief, todo |
| gitflow | 6 | Smart conventional commits, branch management, PR descriptions, changelogs, worktrees, status dashboard |
| github | 6 | Issue CRUD, comments, PR comments, PR reviews via `gh` CLI |
| swarm | 8 | Subagent spawn/status/list/stop, team create/list/delete, messaging, delegation |
| session | 6 | Save/load/list/export sessions, branch, summary |
| session-ops | 8 | Context display, rewind, tag, share, project init, plugin reload, runtime config, version |
| code-intel | 6 | Symbol search, definitions, references, dependencies, outline, complexity |
| lsp | 8 | Definition, references, hover, diagnostics, rename, symbols, implementations, completions |
| mcp | 7 | List servers/tools/resources, call tools, read resources, disconnect, server status |
| memory | 5 | Add/list/search/remove memories, view index |
| context | 5 | Discover context files, compress, estimate tokens, status, add instruction |
| cost | 5 | Track cost, summary, effort/passes config, usage stats, fast mode toggle |
| interactive | 4 | Ask question, confirm action, select from list, input text |
| provider | 4 | List/set/test providers, model aliases |
| bridge | 5 | Spawn/send/receive/close/list bridge sessions |
| repl | 3 | Execute code, list/install runtimes (Python/Node/Ruby) |
| governance | 1 | Permission management |
| skills | 3 | List/load/search skills |
| structured-output | 1 | Generate structured JSON from natural language |
| auth | 3 | OAuth login/status/logout |
| commands | 5+ | Slash commands: /oh-status, /oh-summary, /oh-skills, /oh-usage, /oh-cost |

**Total: 116+ tools, 5+ commands**

## Quick Start

```bash
# Install dependencies
pnpm install

# Type check
npx tsc --noEmit

# Run tests
pnpm -r run test
```

## Plugin Structure

```
plugins/<name>/
├── package.json          # Plugin metadata + dependencies
├── openclaw.plugin.json  # OpenClaw plugin manifest
├── setup-entry.ts        # Setup (create dirs, etc.)
├── src/
│   ├── index.ts          # Main entry — register all tools/commands/hooks
│   └── <module>/
│       └── index.ts      # Module-specific tool definitions
└── tests/
```

### Tool Registration Convention

**Every `api.registerTool()` call MUST include a `name` property** (not just `label`):

```typescript
// ✅ Correct
api.registerTool({
  name: "oh_gitflow_smart_commit",
  label: "Smart Commit",
  parameters: Type.Object({ ... }),
  async execute() { ... },
});

// ❌ Wrong — missing name causes "Cannot read properties of undefined (reading 'trim')"
api.registerTool({
  label: "Smart Commit",
  parameters: Type.Object({ ... }),
  async execute() { ... },
});
```

**Naming convention**: `oh_<module>_<action>` — must be globally unique across all modules.

## Deployment (WSL / NTFS Mount)

Plugins under `/mnt/g/` are blocked by OpenClaw's `path_world_writable` security check. Sync to a native Linux path:

```bash
# Sync to ~/.openclaw/extensions/
./scripts/sync-plugins.sh
```

Configure `plugins.allow` in OpenClaw config to whitelist trusted plugins.

## License

MIT
