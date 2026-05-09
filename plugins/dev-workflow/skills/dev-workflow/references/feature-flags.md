## Feature Flag 友好的开发模式

> 适用：Full 🏗️（可选 Standard 大型功能）| 借鉴：Trunk-Based Development + Feature Flags

### 命名规范

`<scope>_<feature>_<action>`（例：`auth_oauth2_enabled`、`search_advanced_rollout`）

| 类型 | 用途 | 生命周期 |
|------|------|----------|
| Release Flag | 新功能灰度发布 | 全量后删除 |
| Ops Flag | 运维开关（降级、限流） | 长期保留 |
| Experiment Flag | A/B 测试 | 实验结束后删除 |
| Permission Flag | 按用户/角色开放 | 可能长期保留 |

### 代码使用模式

```python
if feature_flags.is_enabled('search_advanced_enabled'):
    return advanced_search(query)
else:
    return basic_search(query)
```

```typescript
function SearchPage() {
  const showAdvanced = useFeatureFlag('search_advanced_enabled');
  return (<><BasicSearch />{showAdvanced && <AdvancedSearch />}</>);
}
```

### 清理时机

| 阶段 | 操作 |
|------|------|
| 功能全量后 | 删除 Release Flag 代码 + 定义 |
| 实验结束后 | 删除 Experiment Flag + 清理分支逻辑 |
| Sprint 末 | 审查所有 flag，标记过期 |
| 季度 | 清理所有过期 flag |

### Feature Flag 注册表

维护 `docs/feature-flags.md`：

| Flag 名称 | 类型 | 状态 | 创建日期 | 计划清理 | 说明 |
|-----------|------|------|----------|----------|------|
| auth_oauth2_enabled | Release | 🟡 灰度中 | 2026-04-01 | TBD | OAuth2 登录 |

### 简单项目方案（零依赖）

```python
import os
FEATURE_FLAGS = {
    'search_advanced_enabled': os.getenv('FF_SEARCH_ADVANCED', 'false').lower() == 'true',
}
def is_enabled(flag_name: str) -> bool:
    return FEATURE_FLAGS.get(flag_name, False)
```

### 流程集成

**Step 3**：design.md 标注需要 flag 的功能 | **Step 5**：先创建 flag（默认关）→ flag 内开发 → 测试时开启 → 完成后保持关闭 | **Step 6**：检查 flag 清理路径

---
