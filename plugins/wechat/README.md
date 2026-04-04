# @openclaw/wechat

[中文文档](./README_CN.md)

WeChat channel plugin for [OpenClaw](https://github.com/openclaw/openclaw), supporting both **WeChat Official Account (公众号服务号)** and **WeCom (企业微信)** platforms.

## Features

- **Dual Platform**: WeChat Official Account (服务号) and WeCom (企业微信) in one plugin
- **Webhook Gateway**: Built-in HTTP callback server for receiving WeChat messages
- **Signature Verification**: SHA1-based signature validation for all inbound requests
- **AES Encryption**: Optional message encryption/decryption via `encodingAESKey`
- **Passive & Customer Service Reply**: 5-second passive reply + async customer service API
- **Media Support**: Image upload and sending for both platforms
- **Account Management**: Multi-account support with per-account platform configuration
- **Pairing & Allowlist**: DM pairing flow with allowlist-based access control
- **Text Chunking**: Automatic message chunking for WeChat's 2048-byte text limit
- **Access Token Management**: Auto-refresh with 2-hour token caching

## Installation

```bash
# In your OpenClaw monorepo
pnpm add @openclaw/wechat --workspace
```

Or place in `extensions/` directory for auto-discovery.

## Configuration

### WeChat Official Account (公众号服务号)

```jsonc
{
  "channels": {
    "wechat": {
      "enabled": true,
      "platform": "official",
      "appId": "wx1234567890abcdef",
      "appSecret": "your-app-secret",
      "token": "your-verify-token",
      "encodingAESKey": "optional-aes-key",
      "webhookPort": 8080,
      "webhookPath": "/wechat/callback",
      "dmPolicy": "pairing",
      "replyToMode": "flat",
    },
  },
}
```

### WeCom (企业微信)

```jsonc
{
  "channels": {
    "wechat": {
      "enabled": true,
      "platform": "wecom",
      "corpid": "ww1234567890abcdef",
      "corpsecret": "your-corp-secret",
      "agentid": 1000002,
      "token": "your-verify-token",
      "encodingAESKey": "optional-aes-key",
      "webhookPort": 8080,
      "webhookPath": "/wechat/callback",
      "dmPolicy": "open",
    },
  },
}
```

### Multi-Account Setup

```jsonc
{
  "channels": {
    "wechat": {
      "enabled": true,
      "defaultAccount": "official",
      "accounts": {
        "official": {
          "platform": "official",
          "appId": "wx111...",
          "appSecret": "secret1",
          "token": "token1",
          "webhookPort": 8081,
        },
        "wecom": {
          "platform": "wecom",
          "corpid": "ww222...",
          "corpsecret": "secret2",
          "agentid": 1000002,
          "token": "token2",
          "webhookPort": 8082,
        },
      },
    },
  },
}
```

### Configuration Options

| Option           | Type                                               | Default              | Description                                    |
| ---------------- | -------------------------------------------------- | -------------------- | ---------------------------------------------- |
| `platform`       | `"official" \| "wecom"`                            | —                    | Platform type (required unless using accounts) |
| `appId`          | string                                             | —                    | Official Account AppID                         |
| `appSecret`      | string                                             | —                    | Official Account AppSecret                     |
| `token`          | string                                             | —                    | Verification token for webhook signature       |
| `encodingAESKey` | string                                             | —                    | Optional AES encryption key (43 chars)         |
| `corpid`         | string                                             | —                    | WeCom Corp ID                                  |
| `corpsecret`     | string                                             | —                    | WeCom Corp Secret                              |
| `agentid`        | number                                             | —                    | WeCom Agent ID                                 |
| `webhookPort`    | number                                             | —                    | HTTP port for webhook callback server          |
| `webhookPath`    | string                                             | `"/wechat/callback"` | URL path for webhook endpoint                  |
| `dmPolicy`       | `"open" \| "pairing" \| "allowlist" \| "disabled"` | `"pairing"`          | Direct message policy                          |
| `groupPolicy`    | `"open" \| "allowlist" \| "disabled"`              | `"disabled"`         | Group message policy                           |
| `allowFrom`      | string[]                                           | `[]`                 | Allowed user IDs (for allowlist mode)          |
| `requireMention` | boolean                                            | `false`              | Require @mention in group chats                |
| `replyToMode`    | `"thread" \| "flat"`                               | `"flat"`             | Reply mode                                     |
| `mediaMaxMb`     | number                                             | `10`                 | Max media upload size in MB                    |
| `maxRetries`     | number                                             | `3`                  | Max API call retries                           |

## How to Use Plugins on WeChat

OpenClaw plugins (like `dev-workflow`) are **cross-channel agent tools**. They are not bound to a specific channel. When a user sends a message through WeChat, the LLM agent decides whether to invoke plugin tools based on intent.

### Message Flow

```
WeChat webhook event (XML over HTTP)
  → channel gateway receives and verifies signature
    → parseXmlMessage() extracts message content
      → resolveAgentRoute() determines target agent
        → dispatchReplyFromConfig() runs agent inference loop
          → LLM may call plugin tools (e.g., dev_workflow_start)
            → Plugin tools execute, may spawn subagents
          → Response streamed back through outbound adapter
            → sendMessageWeChat() delivers reply via customer service API
```

### Enable Plugins for WeChat

```jsonc
{
  "channels": {
    "wechat": {
      "enabled": true,
      "platform": "official",
      "appId": "...",
      "appSecret": "...",
      "token": "...",
    },
  },
  "plugins": {
    "enabled": true,
    "allow": ["wechat", "dev-workflow"],
    "entries": {
      "dev-workflow": {
        "enabled": true,
        "config": { "defaultMode": "standard" },
      },
    },
  },
}
```

Key points:

- `plugins.enabled: true` — master switch for all plugins
- `plugins.allow` — allowlist; only listed plugin IDs are loaded
- `plugins.entries.<id>.enabled: true` — explicitly enable plugins with `enabledByDefault: false`

### Verify Plugin Is Being Called

#### 1. Startup Logs

```bash
OPENCLAW_LOG_LEVEL=debug openclaw gateway run
```

Look for lines like:

```
[plugins] wechat: channel registered (source=workspace)
[plugins] dev-workflow: 5 tools registered
[plugins] dev-workflow: 4 hooks registered
```

#### 2. Hook Logs

Plugins like `dev-workflow` register event hooks that log activity:

```
[dev-workflow] Session started: ...
[dev-workflow] Tool about to be called: dev_workflow_start
[dev-workflow] Tool call completed: ...
```

#### 3. CLI Inspection

```bash
openclaw plugins list       # List all discovered plugins
openclaw plugins status     # Show loaded plugin status
openclaw gateway status     # Show gateway and channel health
```

#### 4. Debug Environment Variables

```bash
OPENCLAW_DEBUG=1 openclaw gateway run                            # Global debug mode
OPENCLAW_PLUGIN_LOADER_DEBUG_STACKS=1 openclaw gateway run       # Plugin load error stacks
```

#### 5. End-to-End Test

Send a message via WeChat that triggers plugin behavior (e.g., `"implement dark mode for the login page"`), then verify:

- `[dev-workflow]` prefixed log lines appear in gateway output
- `dev_workflow_start` tool call is logged
- Bot responds with workflow progress

## WeChat Official Account Setup

### 1. Create a Service Account

Register at [mp.weixin.qq.com](https://mp.weixin.qq.com) and create a **服务号 (Service Account)**.

### 2. Configure Server URL

In the Official Account admin panel, set the server URL to:

```
http://your-server:8080/wechat/callback
```

### 3. Set Token and EncodingAESKey

Match the values in your OpenClaw config. WeChat will send a GET verification request on save.

### 4. Start Gateway

```bash
openclaw gateway run
```

The webhook server will listen on the configured port and respond to WeChat's verification handshake.

## WeCom Setup

### 1. Create a Self-Built Application

In the WeCom admin console ([work.weixin.qq.com](https://work.weixin.qq.com)), create a self-built application.

### 2. Configure Callback URL

Set the receive message callback URL to:

```
http://your-server:8080/wechat/callback
```

### 3. Record Credentials

Note down `corpid`, `corpsecret`, `agentid`, `token`, and optionally `encodingAESKey`.

### 4. Configure and Start

Add credentials to OpenClaw config and run `openclaw gateway run`.

## Architecture

```
src/
├── types.ts          # Domain types (WeChatPlatform, configs, message context)
├── config-schema.ts  # Zod config validation schemas
├── runtime.ts        # Plugin runtime store
├── runtime-api.ts    # Local SDK helpers (PAIRING_APPROVED_MESSAGE, chunkTextForOutbound)
├── client.ts         # API clients (WeChatOfficialClient, WeChatWecomClient)
├── accounts.ts       # Account resolution and listing
├── bot.ts            # XML parsing, message context, passive reply builders
├── send.ts           # Message sending (text + customer service API)
├── outbound.ts       # Outbound adapter (chunking, sendText, sendMedia)
└── channel.ts        # Main channel plugin (createChatChannelPlugin)
```

### API Endpoints Used

| Platform | Endpoint                                                | Purpose                  |
| -------- | ------------------------------------------------------- | ------------------------ |
| Official | `https://api.weixin.qq.com/cgi-bin/token`               | Access token             |
| Official | `https://api.weixin.qq.com/cgi-bin/message/custom/send` | Customer service message |
| Official | `https://api.weixin.qq.com/cgi-bin/media/upload`        | Media upload             |
| WeCom    | `https://qyapi.weixin.qq.com/cgi-bin/gettoken`          | Access token             |
| WeCom    | `https://qyapi.weixin.qq.com/cgi-bin/message/send`      | Send message             |
| WeCom    | `https://qyapi.weixin.qq.com/cgi-bin/media/upload`      | Media upload             |

## Development

```bash
# Install dependencies
pnpm install

# Type check
npx tsc --noEmit

# Run tests (103 tests)
npx vitest run

# Run tests in watch mode
npx vitest

# Test a specific module
npx vitest run tests/client.test.ts
```

## Plugin Discovery

OpenClaw discovers plugins in this order (`src/plugins/discovery.ts`):

| Priority | Path                                | Origin      |
| -------- | ----------------------------------- | ----------- |
| 1        | `plugins.load.paths` in config      | `config`    |
| 2        | `{workspace}/.openclaw/extensions/` | `workspace` |
| 3        | Bundled plugins directory           | `bundled`   |
| 4        | `{configDir}/extensions/`           | `global`    |

This plugin is auto-discovered as part of the `extensions/` workspace in the monorepo.

## License

MIT
