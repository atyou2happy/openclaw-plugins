# Git 经验库
> 自动从项目开发中积累 | v8.0.0

---

## 大型重构用单次 commit 交付
- **来源**：freeapi 重构 (2026-05-06)
- **症状**：36 个文件变更（+2403/-841），如果拆成多个 commit 会导致中间状态不可用
- **根因**：重构涉及跨模块依赖（config.py 被 main.py/routes.py/middleware.py 同时引用），中间 commit 可能 break
- **方案**：在本地完成所有重构 + 测试验证后，一次性 commit + push。commit message 用 conventional 格式：`refactor: v0.1.0 -> v0.2.0 complete refactoring`
- **关键要点**：重构型改动（非功能增量）适合大 commit。功能增量适合小 commit

## 重构前确保 Git 干净
- **来源**：freeapi 重构 (2026-05-06)
- **症状**：开始重构前需确认工作区状态，避免与未提交的改动冲突
- **根因**：已有未提交改动会导致重构 diff 混入旧变更
- **方案**：重构前执行 git status 确认干净，git pull 确保与远程同步。如果有未提交改动先 stash 或 commit
- **关键要点**：git status → git pull → 开始工作。干净的起点是安全重构的前提

## 版本号升级需同步多个文件
- **来源**：freeapi 重构 (2026-05-06)
- **症状**：版本号散落在 pyproject.toml、__init__.py、sdk/python/setup.py 等多处
- **根因**：项目有多包结构（主包 + Python SDK），版本号需要手动同步
- **方案**：用 grep 找到所有版本号位置（grep -rn "0.1.0" → grep -rn "version"），逐一更新。或用单文件（如 __init__.py）作为 version source of truth
- **关键要点**：版本号 = single source of truth。用 grep 验证所有位置已更新

## 测试验证后再 push
- **来源**：freeapi 重构 (2026-05-06)
- **症状**：push 了包含语法错误的代码到远程
- **根因**：未在 push 前运行完整测试套件
- **方案**：push 前必须跑 pytest + import 链验证。三步验证：1) pytest tests/ -v  2) python -c "import module"  3) git push
- **关键要点**：push = pytest 全绿 + import 验证通过。绝不 push 红色测试
