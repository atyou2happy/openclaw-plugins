# Bulk Refactoring Pitfalls & Techniques

> Lessons from multi-file refactoring sessions (config centralization, path replacement, import restructuring).

---

## Pitfall 1: Automated Import Insertion Breaks Files

**Symptom:** A Python script that inserts `from config import ...` after "the last import line" places the import inside a function body, try block, or multi-line import statement.

**Root cause:** Naive "find last `import` line" scans ALL lines including indented ones inside functions/classes/blocks.

**Fix:** Only consider lines with **zero indent** when finding the insertion point:

```python
def find_last_top_level_import(lines):
    last = 0
    for i, line in enumerate(lines):
        stripped = line.strip()
        if not stripped or stripped.startswith("#"):
            continue
        indent = len(line) - len(line.lstrip())
        if indent > 0:
            continue  # skip indented (inside function/class)
        if stripped.startswith("import ") or stripped.startswith("from "):
            last = i
    return last
```

**Also breaks when:** Inserting into the middle of a multi-line `from xxx import (\n    A,\n    B,\n)`. The script sees `from xxx import` as the last import and inserts after it, splitting the block.

**Fix:** Before inserting, check if the line after the target is indented (continuation of multi-line import). If so, find the closing `)` first.

---

## Pitfall 2: "Use Before Import" After Bulk Replacement

**Symptom:** `NameError: name 'PROJECT_DIR' is not defined` at module level.

**Root cause:** Path string replacement (e.g., `"/mnt/g/..."` → `str(PROJECT_DIR)`) creates references to config variables. But the `from config import` is inserted at the end of the import block, while the replaced line (e.g., `BASE_DIR = str(PROJECT_DIR)`) is at the top of the file.

**Fix:** After inserting config imports, scan for config variable usage BEFORE the import line. If found, move the import block up. Script pattern: extract the config import block, delete from current position, re-insert after the last import before the first usage.

---

## Pitfall 3: Variable Name Shadowing

**Symptom:** `NameError: name 'TUSHARE_STOCK_DIR' is not defined` even though config import is present.

**Root cause:** Local variable has the same name as the imported one. Example:
```python
from config import TUSHARE_DIR  # imported
TUSHARE_DIR = str(TUSHARE_STOCK_DIR)  # shadows import, TUSHARE_STOCK_DIR not imported
```

**Fix:** Import the ACTUAL needed variable, and use a different local name if needed:
```python
from config import TUSHARE_STOCK_DIR
TUSHARE_DIR = str(TUSHARE_STOCK_DIR)  # OK now
```

---

## Safe Strategy: sed-First, Then Careful Import Insertion

### Phase 1: String replacement with sed (safe — no structural changes)
```bash
find . -name '*.py' -print0 | xargs -0 sed -i \
  -e 's|Path("/old/path")|NEW_VAR|g' \
  -e 's|"/old/path"|str(NEW_VAR)|g'
```

### Phase 2: Syntax check (catch any sed misfires)
```python
for f in py_files:
    compile(open(f).read(), f, 'exec')  # catches SyntaxError
```

### Phase 3: Add imports with indent-aware script
Use the `find_last_top_level_import()` approach. Verify each file individually.

### Phase 4: "Use before import" scan
```python
# For each file, check if config vars appear before the import line
for i in range(config_import_line):
    if re.search(r'\bPROJECT_DIR\b', lines[i]):
        # Move import up!
```

### Phase 5: Full import chain verification
```python
from config import PROJECT_DIR; print('✅ config')
from zt_selector import run_selection; print('✅ zt_selector')
# ... test all core modules
```

### Phase 6: Format with black
```bash
find . -name '*.py' -exec black --line-length 120 {} +
```

---

## Key Numbers (for estimation)

| Metric | Value |
|--------|-------|
| Files affected by path centralization | ~38 files |
| Hardcoded paths replaced | ~70 occurrences |
| Files broken by naive auto-insert | 17 files |
| Time to fix auto-insert breakage | ~30 min |
| Time with sed-first strategy | ~5 min for replacement, ~15 min for import insertion |

**Rule of thumb:** For bulk string replacement across >20 files, use `sed`. For import insertion, use a careful indent-aware script and ALWAYS verify syntax before testing imports.
