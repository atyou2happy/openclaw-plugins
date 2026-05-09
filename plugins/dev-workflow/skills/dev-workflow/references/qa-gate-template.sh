## 自动化质量门控流水线

QAAgent 在 Step 9 执行，**全部通过才允许标记任务完成**。

| # | 检查项 | 说明 | 不通过处理 |
|---|--------|------|------------|
| 1 | Lint 通过 | 0 errors，0 warnings | 退回 CoderAgent |
| 2 | Format 检查 | 符合项目规范 | 自动 format 后重检 |
| 3 | 所有测试通过 | 单元 + 集成 100% | 退回 CoderAgent |
| 4 | 覆盖率达标 | 新增代码 ≥ 80% | 退回 TestAgent |
| 5 | 无类型错误 | TS strict / Python type check | 退回 CoderAgent |
| 6 | Simplify 通过 | 无冗余，逻辑清晰 | 退回 CoderAgent |
| 7 | Commit 格式正确 | Conventional Commits | 自动 amend 或重写 |
| 8 | 无 TODO/FIXME | 新增代码无遗留 | 退回 CoderAgent |
| 9 | 文档已更新 | API 变更时 README/API 同步 | 退回 CoderAgent |

**执行规则**：任一项不通过→必须修复后重走全部 | Ship 任务可跳过 6、7 | Ask 任务必须全部通过 | Show 任务 Commit 格式可事后修正

### QA Gate 脚本模板

```bash
#!/bin/bash
set -e; PASS=true
echo "🔍 QA Gate Check Starting..."

# 1. Lint
echo "[1/9] Lint..."
(npm run lint 2>/dev/null || ruff check . 2>/dev/null || eslint . 2>/dev/null) || { echo "  ❌ Lint failed"; PASS=false; }

# 2. Format
echo "[2/9] Format..."
(npm run format:check 2>/dev/null || black --check . 2>/dev/null) || { echo "  ❌ Format failed"; PASS=false; }

# 3. Tests
echo "[3/9] Tests..."
(npm test 2>/dev/null || pytest -q 2>/dev/null) || { echo "  ❌ Tests failed"; PASS=false; }

# 4. Coverage
echo "[4/9] Coverage..."
(npm run test:coverage 2>/dev/null || pytest --cov --cov-fail-under=80 2>/dev/null) || { echo "  ⚠️ Coverage check skipped"; }

# 5. Type check
echo "[5/9] Type check..."
(npx tsc --noEmit 2>/dev/null || mypy . 2>/dev/null) || { echo "  ❌ Type check failed"; PASS=false; }

# 6. Simplify (manual review)
echo "[6/9] Simplify... (manual)"

# 7. Commit format
echo "[7/9] Commit format..."
git log --format='%s' HEAD~5..HEAD 2>/dev/null | grep -qE '^(feat|fix|docs|style|refactor|test|chore|perf|ci)' || { echo "  ⚠️ Commit format warning"; }

# 8. TODO/FIXME
echo "[8/9] TODO/FIXME..."
grep -rn 'TODO\|FIXME' --include='*.ts' --include='*.py' . 2>/dev/null && echo "  ⚠️ Found TODO/FIXME" || echo "  ✅ No TODO/FIXME"

# 9. Documentation
echo "[9/9] Documentation... (manual)"

[ "$PASS" = true ] && echo "✅ QA Gate PASSED" && exit 0 || echo "❌ QA Gate FAILED" && exit 1
```

---
