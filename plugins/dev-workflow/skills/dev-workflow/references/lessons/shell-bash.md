# Shell/Bash Project Lessons

> From openclaw-cli-toolkit v4→v5 refactoring (Shell+Python hybrid, 308 tests, 2026-05-06)

---

## 1. paths.sh Centralization

**Source**: openclaw-cli-toolkit refactor (5 files had duplicate path calculations)

**Symptom**: `PROJECT_DIR`, `VERSION`, `SRC_DIR` computed independently in 5+ shell files using different methods (`dirname $0`, `BASH_SOURCE[0]`, `pwd`). One change requires editing all files.

**Solution**: Create `src/paths.sh` as single source of truth:

```bash
# src/paths.sh — ALL path definitions in one place
PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
VERSION_FILE="$PROJECT_DIR/VERSION"
SRC_DIR="$PROJECT_DIR/src"
TOOLS_DIR="$PROJECT_DIR/tools"
METHODS_DIR="$SRC_DIR/methods"
CONFIG_FILE="$PROJECT_DIR/config.yaml"
INSTALL_LOG="$HOME/.openclaw/install.log"
```

Every other file does: `source "$SRC_DIR/paths.sh"` — zero path duplication.

**Key pitfall**: `${BASH_SOURCE[0]}` expansion — when writing shell files from tools, `\${BASH_SOURCE[0]}` gets double-escaped. Write with terminal heredoc, not write_file.

---

## 2. Source-Based Module Splitting

**Source**: openclaw-cli-toolkit refactor (394-line installer.sh → 6 method files + 120-line dispatcher)

**Pattern**: Large shell file with case-based dispatch → split into `methods/` directory.

```bash
# Before: 394-line installer.sh with inline apt/brew/pip/go/cargo/github logic

# After: src/methods/ directory
src/methods/apt.sh      # apt-get install logic (~30 lines each)
src/methods/brew.sh     # brew install logic
src/methods/pip.sh      # pip install logic
src/methods/cargo.sh    # cargo install logic
src/methods/go.sh       # go install with proxy fallback
src/methods/github.sh   # GitHub Release binary download (~130 lines)
```

Dispatcher becomes:
```bash
# src/installer.sh (~120 lines)
source "$METHODS_DIR"/*.sh   # load all method modules

try_install_method() {
    case "$method" in
        apt) install_via_apt "$tool_name" "$tool_config" ;;
        brew) install_via_brew "$tool_name" ;;
        pip) install_via_pip "$tool_name" "$tool_config" ;;
        # ...add new method = add one file + one line
    esac
}
```

**Why source, not subshell**: Variables must be shared (INSTALL_LOG, PROJECT_DIR, etc.). Subshells can't modify parent scope.

**Adding a new install method**: Create `methods/newmethod.sh` with `install_via_newmethod()` function, add one line to dispatcher case statement.

---

## 3. Shell Testing Methodology

**Source**: openclaw-cli-toolkit (27 structure tests + 52 install tests + 229 pytest = 308 total)

### Structure tests (test_structure.sh)

Test the project's own structure — not runtime behavior:
```bash
# Example: verify paths.sh defines all required variables
test_paths_sh_defines_variables() {
    source "$SRC_DIR/paths.sh"
    [[ -n "$PROJECT_DIR" ]] || { echo "FAIL: PROJECT_DIR not set"; return 1; }
    [[ -n "$METHODS_DIR" ]] || { echo "FAIL: METHODS_DIR not set"; return 1; }
    [[ -d "$METHODS_DIR" ]] || { echo "FAIL: METHODS_DIR doesn't exist"; return 1; }
}
```

27 tests cover: file existence, directory structure, variable definitions, source loading order, script syntax (bash -n).

### Install tests (test_install.sh)

Mock-based functional tests using `--dry-run` flag:
```bash
# Tools YAML parsing, config loading, dry-run execution
bash install.sh --dry-run  # validates 98 tools parse correctly
```

### Cross-language test orchestration

```makefile
# Makefile
test: test-shell test-python

test-shell:
	bash tests/test_structure.sh
	bash tests/test_install.sh --dry-run

test-python:
	pytest tests/python/ -v
```

---

## 4. Shell Variable Scoping Traps

### Subshell variable loss
```bash
# BUG: piping into while creates subshell, counter lost
cat file.txt | while read line; do
    count=$((count + 1))
done
echo $count  # 0 — lost!

# FIX: redirect stdin
while read line; do
    count=$((count + 1))
done < file.txt
echo $count  # correct
```

### source vs subshell for module loading
```bash
# WRONG: runs in subshell, functions/variables not available
$(source module.sh)

# RIGHT: runs in current shell
source module.sh
```

### BASH_SOURCE[0] vs $0
- `$0` → the script name as invoked (can be relative, can be symlink)
- `${BASH_SOURCE[0]}` → the actual file being sourced/executed
- Always use `${BASH_SOURCE[0]}` for `PROJECT_DIR` calculation

---

## 5. Hybrid Shell+Python Projects

**Pattern**: Shell for CLI/orchestration, Python for data processing.

### pyproject.toml for dev only
```toml
# pyproject.toml — NOT for packaging, just dev tool config
[tool.ruff]
line-length = 120

[tool.pytest.ini_options]
testpaths = ["tests/python"]
```

No `setup.py`, no `pyproject.toml` `[project]` section. Scripts run directly.

### Python called from Shell
```bash
# Shell orchestrator calls Python for complex logic
TOOLS_JSON=$(python3 "$SRC_DIR/parse_tools.py" "$TOOLS_DIR")
```

### Shared configuration bridge
Shell's `paths.sh` and Python's config should agree on paths. Single source of truth in `paths.sh`, Python reads from env vars or shell output.

---

## 6. write_file Tool Escape Sequences

**Source**: openclaw-cli-toolkit + multiple other projects

**Critical pitfall**: When writing shell/Python files via write_file tool:
- `\n` becomes literal newline (not escape sequence)
- `\t` becomes literal tab
- `\$var` becomes `$var` (losing the escape)
- `${BASH_SOURCE[0]}` may get expanded or mangled

**Workaround**: Use terminal with heredoc for any file containing backslash escapes:
```bash
python3 << 'PYEOF'
content = 'line1\\nline2'  # \\n stays as \n in the file
with open('output.py', 'w') as f:
    f.write(content)
PYEOF
```

Or use `sed` for targeted insertions.
