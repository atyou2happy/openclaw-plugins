# @openclaw/wechat

[English](./README.md)

微信渠道插件，为 [OpenClaw](https://github.com/openclaw/openclaw) 提供 **微信公众号服务号** 和 **企业微信** 双平台支持。

## 功能特性

- **双平台支持**：公众号服务号和企业微信合二为一
- **Webhook 网关**：内置 HTTP 回调服务器接收微信消息
- **签名验证**：基于 SHA1 的请求签名校验
- **AES 加解密**：可选的消息加解密（`encodingAESKey`）
- **被动回复 + 客服消息**：5 秒内被动回复 + 异步客服 API
- **媒体支持**：双平台的图片上传与发送
- **多账号管理**：支持按账号配置不同平台
- **配对与白名单**：私聊配对流程 + 白名单访问控制
- **文本分片**：自动按微信 2048 字节限制分片发送
- **Access Token 管理**：自动刷新，2 小时缓存

## 安装

```bash
# 在 OpenClaw monorepo 中
pnpm add @openclaw/wechat --workspace
```

或放入 `extensions/` 目录自动发现。

## 配置

### 公众号服务号

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

### 企业微信

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

### 多账号配置

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

### 配置选项

| 选项             | 类型                                               | 默认值               | 说明                             |
| ---------------- | -------------------------------------------------- | -------------------- | -------------------------------- |
| `platform`       | `"official" \| "wecom"`                            | —                    | 平台类型（使用 accounts 时可选） |
| `appId`          | string                                             | —                    | 公众号 AppID                     |
| `appSecret`      | string                                             | —                    | 公众号 AppSecret                 |
| `token`          | string                                             | —                    | Webhook 签名验证 Token           |
| `encodingAESKey` | string                                             | —                    | 可选 AES 加密密钥（43 字符）     |
| `corpid`         | string                                             | —                    | 企业微信 Corp ID                 |
| `corpsecret`     | string                                             | —                    | 企业微信 Corp Secret             |
| `agentid`        | number                                             | —                    | 企业微信应用 Agent ID            |
| `webhookPort`    | number                                             | —                    | HTTP 回调端口                    |
| `webhookPath`    | string                                             | `"/wechat/callback"` | 回调 URL 路径                    |
| `dmPolicy`       | `"open" \| "pairing" \| "allowlist" \| "disabled"` | `"pairing"`          | 私聊策略                         |
| `groupPolicy`    | `"open" \| "allowlist" \| "disabled"`              | `"disabled"`         | 群聊策略                         |
| `allowFrom`      | string[]                                           | `[]`                 | 允许的用户 ID（白名单模式）      |
| `requireMention` | boolean                                            | `false`              | 群聊中是否需要 @机器人           |
| `replyToMode`    | `"thread" \| "flat"`                               | `"flat"`             | 回复模式                         |
| `mediaMaxMb`     | number                                             | `10`                 | 媒体上传大小上限（MB）           |
| `maxRetries`     | number                                             | `3`                  | API 调用最大重试次数             |

## 如何在微信上使用 OpenClaw 插件

OpenClaw 插件（如 `dev-workflow`）是**跨渠道的 agent 工具**，不绑定到特定渠道。用户通过微信发消息时，LLM agent 根据意图自动决定是否调用插件工具。

### 消息流转

```
微信 webhook 事件（XML over HTTP）
  → 渠道网关接收并验证签名
    → parseXmlMessage() 提取消息内容
      → resolveAgentRoute() 确定目标 agent
        → dispatchReplyFromConfig() 启动 agent 推理循环
          → LLM 可能调用插件工具（如 dev_workflow_start）
            → 插件工具执行，可能 spawn subagent
          → 响应通过 outbound adapter 流式返回
            → sendMessageWeChat() 通过客服 API 投递回复
```

### 为微信启用插件

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

关键配置：

- `plugins.enabled: true` — 插件总开关
- `plugins.allow` — 白名单，只有列出的插件 ID 会被加载
- `plugins.entries.<id>.enabled: true` — 显式启用 `enabledByDefault: false` 的插件

### 如何确认插件真的被调用了

#### 1. 启动日志

```bash
OPENCLAW_LOG_LEVEL=debug openclaw gateway run
```

观察是否出现：

```
[plugins] wechat: channel registered (source=workspace)
[plugins] dev-workflow: 5 tools registered
[plugins] dev-workflow: 4 hooks registered
```

#### 2. Hook 日志

`dev-workflow` 等插件会注册事件 hook 并输出日志：

```
[dev-workflow] Session started: ...
[dev-workflow] Tool about to be called: dev_workflow_start
[dev-workflow] Tool call completed: ...
```

只要用户发了消息触发 session，就应看到 `session_start` 日志。

#### 3. CLI 命令查看

```bash
openclaw plugins list       # 列出所有已发现的插件
openclaw plugins status     # 查看已加载插件状态
openclaw gateway status     # 查看 gateway 状态和渠道健康
```

#### 4. 调试环境变量

```bash
OPENCLAW_DEBUG=1 openclaw gateway run                            # 全局 debug 模式
OPENCLAW_PLUGIN_LOADER_DEBUG_STACKS=1 openclaw gateway run       # 插件加载错误堆栈
```

#### 5. 端到端测试

通过微信发送一条会触发插件行为的消息（如 `"实现登录页面的暗黑模式"`），然后验证：

- gateway 日志中是否出现 `[dev-workflow]` 前缀的日志
- 是否看到 `dev_workflow_start` 工具被调用
- 机器人是否回复了工作流进度

## 公众号服务号配置步骤

### 1. 创建服务号

在 [mp.weixin.qq.com](https://mp.weixin.qq.com) 注册并创建**服务号**。

### 2. 配置服务器地址

在公众号管理后台设置服务器 URL：

```
http://your-server:8080/wechat/callback
```

### 3. 设置 Token 和 EncodingAESKey

与 OpenClaw 配置中的值一致。保存时微信会发送 GET 验证请求。

### 4. 启动 Gateway

```bash
openclaw gateway run
```

Webhook 服务器将在配置的端口监听，并响应微信的验证握手。

## 企业微信配置步骤

### 1. 创建自建应用

在企业微信管理后台 ([work.weixin.qq.com](https://work.weixin.qq.com)) 创建自建应用。

### 2. 配置回调 URL

设置接收消息回调 URL：

```
http://your-server:8080/wechat/callback
```

### 3. 记录凭证

记下 `corpid`、`corpsecret`、`agentid`、`token` 及可选的 `encodingAESKey`。

### 4. 配置并启动

将凭证填入 OpenClaw 配置，然后运行 `openclaw gateway run`。

## 架构

```
src/
├── types.ts          # 领域类型（WeChatPlatform、配置、消息上下文）
├── config-schema.ts  # Zod 配置校验 schema
├── runtime.ts        # 插件运行时存储
├── runtime-api.ts    # 本地 SDK 辅助（PAIRING_APPROVED_MESSAGE、chunkTextForOutbound）
├── client.ts         # API 客户端（WeChatOfficialClient、WeChatWecomClient）
├── accounts.ts       # 账号解析和列举
├── bot.ts            # XML 解析、消息上下文、被动回复构建
├── send.ts           # 消息发送（文本 + 客服 API）
├── outbound.ts       # 出站适配器（分片、sendText、sendMedia）
└── channel.ts        # 主渠道插件（createChatChannelPlugin）
```

### 使用的 API 端点

| 平台     | 端点                                                    | 用途         |
| -------- | ------------------------------------------------------- | ------------ |
| 公众号   | `https://api.weixin.qq.com/cgi-bin/token`               | Access Token |
| 公众号   | `https://api.weixin.qq.com/cgi-bin/message/custom/send` | 客服消息     |
| 公众号   | `https://api.weixin.qq.com/cgi-bin/media/upload`        | 媒体上传     |
| 企业微信 | `https://qyapi.weixin.qq.com/cgi-bin/gettoken`          | Access Token |
| 企业微信 | `https://qyapi.weixin.qq.com/cgi-bin/message/send`      | 发送消息     |
| 企业微信 | `https://qyapi.weixin.qq.com/cgi-bin/media/upload`      | 媒体上传     |

## 开发

```bash
# 安装依赖
pnpm install

# 类型检查
npx tsc --noEmit

# 运行测试（103 个测试）
npx vitest run

# 监听模式
npx vitest

# 测试特定模块
npx vitest run tests/client.test.ts
```

## 插件发现

OpenClaw 按以下顺序发现插件（`src/plugins/discovery.ts`）：

| 优先级 | 路径                                | 来源        |
| ------ | ----------------------------------- | ----------- |
| 1      | 配置中的 `plugins.load.paths`       | `config`    |
| 2      | `{workspace}/.openclaw/extensions/` | `workspace` |
| 3      | 内置插件目录                        | `bundled`   |
| 4      | `{configDir}/extensions/`           | `global`    |

本插件作为 monorepo 中 `extensions/` workspace 的一部分被自动发现。

## License

MIT
