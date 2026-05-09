# 安全审计方法论（借鉴 gstack CSO）

## 两种模式

| 模式 | 置信度门槛 | 频率 |
|------|-----------|------|
| Daily | 8/10（零噪音） | 每次发布前 |
| Comprehensive | 2/10（深挖） | 每月一次 |

## Phase 0: 架构心智模型

- 检测技术栈（自动扫描 package.json/requirements.txt/go.mod 等）
- 建立数据流：用户输入从哪进？到哪出？经过什么变换？
- 画出信任边界

## Phase 1: 攻击面普查

```
CODE SURFACE
  公开端点: N（无需认证）
  认证端点: N
  管理端点: N
  文件上传: N
  外部集成: N
  后台任务: N

INFRA SURFACE
  CI/CD: N
  Webhook: N
  容器配置: N
  密钥管理: [env vars | KMS | vault]
```

## Phase 2: 密钥考古

- git历史扫描：`git log -p --all -S "AKIA|sk-|ghp_|xoxb-" -- "*.env" "*.yml"`
- .env是否在.gitignore
- CI配置中的内联密钥

## Phase 3: 依赖供应链

- 运行 `npm audit` / `pip audit` / 对应工具
- 检查生产依赖的 install scripts（供应链攻击向量）
- 锁文件是否存在且被git追踪

## Phase 4: OWASP Top 10 检查

| # | 类别 | 检查要点 |
|---|------|----------|
| 1 | 注入 | SQL拼接、命令注入、模板注入 |
| 2 | 认证 | 弱密码策略、session管理 |
| 3 | 敏感数据 | 明文存储、传输加密 |
| 4 | XXE | XML解析器配置 |
| 5 | 访问控制 | 水平/越权 |
| 6 | 配置错误 | 默认凭据、目录遍历 |
| 7 | XSS | 输出编码、CSP |
| 8 | 反序列化 | 不安全的unpickle/unmarshal |
| 9 | 已知漏洞 | 依赖版本检查 |
| 10 | SSRF | URL验证、内网保护 |

## Phase 5: STRIDE 威胁建模

| 威胁 | 检查点 |
|------|--------|
| Spoofing | 身份伪造 |
| Tampering | 数据篡改 |
| Repudiation | 操作抵赖 |
| Info Disclosure | 信息泄露 |
| Denial of Service | 拒绝服务 |
| Elevation | 权限提升 |

## 误报排除规则
- 占位符（"your_"、"changeme"、"TODO"）排除
- 测试fixture排除（除非同值出现在非测试代码）
- 已轮换的密钥仍标记（曾经暴露过）

---

## Standard 模式轻量扫描 ⭐v6

Standard模式Step 10自动执行，不阻塞。

### 检查项（5秒完成）

```bash
grep -rn "API_KEY\|SECRET_KEY\|PASSWORD\|PRIVATE_KEY\|\.env" --include="*.ts" --include="*.js" --include="*.py" --include="*.json" . | grep -v node_modules | grep -v ".example"
```

### 检查模式

| 模式 | 说明 |
|------|------|
| API_KEY / SECRET_KEY | 硬编码的API密钥 |
| PASSWORD | 硬编码密码 |
| PRIVATE_KEY | 私钥泄露 |
| .env | .env文件内容被提交 |
| token / bearer | 认证token泄露 |

### 发现时

- 立即报告用户，标注严重度
- 不阻塞流程（用户决定是否处理）
- 建议移至环境变量或密钥管理服务
