# 模型Tier配置

> v6.0.0 | 借鉴：GSD-OpenCode 动态模型切换

---

## 概述

不硬编码模型名，按任务能力需求匹配Tier。每个Tier有 primary + fallback 链。

---

## Tier定义

| Tier | 适用场景 | 典型角色 |
|------|---------|---------|
| **lightweight** | 格式化、搜索替换、简单文档 | Brainstorm |
| **standard** | 分析、生成、编码、测试 | Spec, Coder, Test |
| **advanced** | 架构设计、调试、代码审查 | Review, Debug |
| **critical** | 安全审计、核心决策 | Security |

---

## 模型映射

```yaml
lightweight:
  primary: "Llama 3.3 70B"           # 0.3s, 免费, 极稳定
  fallback:
    - "MiniMax M2.5 Free"             # 1.6s, 免费
    - "Qwen 3.6 Plus Free"           # 免费

standard:
  primary: "Qwen 3.6 Plus Free"       # 免费, 通用强
  fallback:
    - "MiniMax M2.5 Free"
    - "Llama 3.3 70B"

advanced:
  primary: "GLM-5.1"                  # Coding Plan, 核心模型
  fallback:
    - "DeepSeek V3.2"                 # 按量, 推理强
    - "Kimi K2.5"                     # 按量, 长文档

critical:
  primary: "GLM-5.1"
  fallback:
    - "DeepSeek V3.2"
```

---

## 选择逻辑

```
1. 按角色查默认Tier（见上表）
2. 用户指定模型 → 覆盖默认，直接使用
3. 未指定 → 使用Tier的primary模型
4. 429/超时 → 自动切fallback第一个
5. 仍429 → 切第二个
6. 全部不可用 → 降级到上一Tier重试
```

---

## 角色→Tier映射

| 角色 | 默认Tier | 说明 |
|------|---------|------|
| Brainstorm | lightweight | 探索性任务，无需强模型 |
| Spec | standard | 需要理解需求+结构化输出 |
| Coder | standard | 编码任务 |
| Review | advanced | 需要深度理解代码质量 |
| Security | critical | 安全审计需要最强推理 |
| Test | standard | 测试生成 |
| Debug | advanced | 根因分析需要推理 |
| Design | advanced | API设计需要架构思维 |

---

## 维护指南

**何时更新**：
- 模型下线/改名 → 更新对应Tier的primary或fallback
- 新模型上线 → 测试后加入fallback链
- 免费额度变化 → 调整Tier优先级

**测试方法**：
- 运行 `tools/model_health_check.py` 检查可用性
- 检查 `data/model-health.json` 中7天历史
- 可用率<50% → 考虑替换primary

**原则**：
- 免费模型优先（lightweight/standard尽量用免费）
- 付费模型只用于advanced/critical
- fallback链中至少一个免费模型（兜底）
