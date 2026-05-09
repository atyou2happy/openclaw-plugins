## Conventional Commits 规范

```
type(scope): description
[optional body]
[optional footer(s)]
```

| 类型 | 用途 | 示例 |
|------|------|------|
| `feat` | 新功能 | `feat(auth): add JWT token refresh` |
| `fix` | 修 bug | `fix(api): handle null response` |
| `docs` | 文档 | `docs(readme): add installation guide` |
| `style` | 格式（不影响逻辑） | `style: fix indentation` |
| `refactor` | 重构 | `refactor(db): extract connection pool` |
| `test` | 测试 | `test(auth): add unit tests` |
| `chore` | 构建/工具 | `chore(deps): upgrade express` |
| `perf` | 性能优化 | `perf(query): add index` |
| `ci` | CI/CD | `ci: add GitHub Actions` |

**Scope**：与 feature 分支名一致（auth/api/ui/db/config），无明确模块可省略。

### 自动 Changelog（git-cliff）

**配置**：项目根目录创建 `cliff.toml`，配置 changelog 格式（参考 [git-cliff 文档](https://git-cliff.org/docs/configuration)），包含 changelog 头部模板、commit 解析规则、分组规则。

```bash
git-cliff -o CHANGELOG.md
```

**Tag & Release 集成**：
```bash
git-cliff -o CHANGELOG.md && git add CHANGELOG.md && git commit -m "chore: update CHANGELOG.md"
git tag v<版本号> && git push && git push --tags
gh release create v<版本号> --title "v<版本号>" --notes "$(git-cliff v<版本号>)"
```

---
