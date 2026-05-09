## PR 模板自动化

> 适用：Full 🏗️（强制）| Standard 📋（Ask 推荐）| Quick 🏃（不使用）

### PR 描述自动生成

```bash
#!/bin/bash
# .kilocode/scripts/generate-pr-description.sh
BASE_BRANCH=${1:-main}; CURRENT_BRANCH=$(git branch --show-current)
echo "## 变更摘要\n\n分支：\`${CURRENT_BRANCH}\`\n目标：\`${BASE_BRANCH}\`\n"
echo "### Commits"; git log ${BASE_BRANCH}..HEAD --format="- %s" --reverse
echo "\n### 变更类型"
FEAT=$(git log ${BASE_BRANCH}..HEAD --format='%s' | grep -c '^feat' || true)
FIX=$(git log ${BASE_BRANCH}..HEAD --format='%s' | grep -c '^fix' || true)
echo "- 新功能：${FEAT} | Bug 修复：${FIX}"
echo "\n### 文件变更"; git diff --stat ${BASE_BRANCH}...HEAD
```

### PR 模板

```markdown
## 变更摘要 <!-- auto-generated -->
## 变更类型 <!-- 勾选：🚀 新功能 | 🐛 Bug 修复 | 📝 文档 | ♻️ 重构 | ⚡ 性能 | ✅ 测试 | 🔧 其他 -->
## 测试情况 <!-- 单元测试 | 集成测试 | 手动测试 | 新增测试覆盖 -->
## 风险评级 <!-- 🟢 低风险 | 🟡 中风险 | 🔴 高风险 -->
## Changelog 条目 <!-- auto-generated，供 git-cliff 使用 -->
## Ship/Show/Ask 分类 <!-- 🚢 Ship | 👀 Show | ❓ Ask -->
## 检查清单 <!-- Spec 已更新 | 无 TODO/FIXME | 文档已同步 | 破坏性变更已标注 -->
```

### 与 Step 6 集成

```
Step 6 → 生成 PR 变更摘要 → 填充 PR 模板 → ReviewAgent 审查 → 按 Ship/Show/Ask 决定合入策略
```

**Ship**：跳过 PR 模板，直接 commit | **Show**：生成模板，合入后异步 review | **Ask**：完整模板 + 必须 review

---
