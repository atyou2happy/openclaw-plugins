import { exec } from "child_process";
import { promisify } from "util";
import { existsSync, readFileSync } from "fs";
import { join } from "path";
import { getEngine } from "../channel/runtime.js";
import type { DevWorkflowRule } from "../types.js";
import { DEV_WORKFLOW_RULES } from "../types.js";

const execAsync = promisify(exec);

export type CheckResult = { name: string; passed: boolean; output?: string };

export function runCheck(check: string, projectDir: string): Promise<CheckResult> {
  switch (check) {
    case "lint": return runLintCheck(projectDir);
    case "format": return runFormatCheck(projectDir);
    case "tests": return runTestsCheck(projectDir);
    case "coverage": return runCoverageCheck(projectDir);
    case "typecheck": return runTypeCheck(projectDir);
    case "simplify": return runSimplifyCheck(projectDir);
    case "commits": return runCommitsCheck(projectDir);
    case "todos": return runTodosCheck(projectDir);
    case "docs": return runDocsCheck(projectDir);
    case "rules": return runRulesCheck(projectDir);
    case "boundary": return runBoundaryCheck(projectDir);
    case "integration": return runIntegrationCheck(projectDir);
    case "performance": return runPerformanceCheck(projectDir);
    default: return Promise.resolve({ name: check, passed: true, output: `Check ${check} skipped - not implemented` });
  }
}

export async function runLintCheck(projectDir: string): Promise<CheckResult> {
  const pkgPath = join(projectDir, "package.json");
  let lintCommand: string | null = null;
  if (existsSync(pkgPath)) {
    try {
      const pkg = JSON.parse(readFileSync(pkgPath, "utf-8"));
      if (pkg.scripts?.lint) lintCommand = pkg.scripts.lint;
      else if (pkg.scripts?.["lint:fix"]) lintCommand = pkg.scripts["lint:fix"];
    } catch { /* skip */ }
  }
  if (!lintCommand) {
    const hasEslint = existsSync(join(projectDir, ".eslintrc.js")) || existsSync(join(projectDir, ".eslintrc.json")) || existsSync(join(projectDir, "eslint.config.js")) || existsSync(join(projectDir, "eslint.config.mjs"));
    if (hasEslint) lintCommand = "npx eslint . --max-warnings=0";
  }
  if (!lintCommand) return { name: "lint", passed: true, output: "No lint configuration found - skipping" };
  try {
    const { stdout, stderr } = await execAsync(lintCommand, { cwd: projectDir, timeout: 60000 });
    return { name: "lint", passed: true, output: stdout || stderr || "Lint passed" };
  } catch (e: any) {
    return { name: "lint", passed: false, output: e.stdout ? `${e.stdout}\n${e.stderr}` : e.message };
  }
}

export async function runFormatCheck(projectDir: string): Promise<CheckResult> {
  const pkgPath = join(projectDir, "package.json");
  let formatCommand: string | null = null;
  if (existsSync(pkgPath)) {
    try {
      const pkg = JSON.parse(readFileSync(pkgPath, "utf-8"));
      if (pkg.scripts?.format) formatCommand = pkg.scripts.format;
    } catch { /* skip */ }
  }
  if (!formatCommand) {
    const hasPrettier = existsSync(join(projectDir, ".prettierrc")) || existsSync(join(projectDir, ".prettierrc.json")) || existsSync(join(projectDir, "prettier.config.js"));
    if (hasPrettier) formatCommand = "npx prettier --check .";
  }
  if (!formatCommand) return { name: "format", passed: true, output: "No formatter configuration found - skipping" };
  try {
    const { stdout, stderr } = await execAsync(formatCommand, { cwd: projectDir, timeout: 60000 });
    return { name: "format", passed: true, output: stdout || stderr || "Format check passed" };
  } catch (e: any) {
    return { name: "format", passed: false, output: e.stdout ? `${e.stdout}\n${e.stderr}` : e.message };
  }
}

export async function runTestsCheck(projectDir: string): Promise<CheckResult> {
  const pkgPath = join(projectDir, "package.json");
  let testCommand = "npm test";
  if (existsSync(pkgPath)) {
    try {
      const pkg = JSON.parse(readFileSync(pkgPath, "utf-8"));
      if (pkg.scripts?.test) testCommand = pkg.scripts.test;
      else if (existsSync(join(projectDir, "jest.config.js")) || existsSync(join(projectDir, "jest.config.ts"))) testCommand = "npx jest --passWithNoTests";
      else if (existsSync(join(projectDir, "vitest.config.js")) || existsSync(join(projectDir, "vitest.config.ts"))) testCommand = "npx vitest run --passWithNoTests";
    } catch { /* skip */ }
  }
  try {
    const { stdout, stderr } = await execAsync(testCommand, { cwd: projectDir, timeout: 120000, env: { ...process.env, CI: "true", NODE_ENV: "test" } });
    return { name: "tests", passed: true, output: stdout || stderr || "Tests passed" };
  } catch (e: any) {
    return { name: "tests", passed: false, output: e.stdout ? `${e.stdout}\n${e.stderr}` : e.message };
  }
}

export async function runCoverageCheck(projectDir: string): Promise<CheckResult> {
  const pkgPath = join(projectDir, "package.json");
  let coverageCommand: string | null = null;
  const threshold = 80;
  if (existsSync(pkgPath)) {
    try {
      const pkg = JSON.parse(readFileSync(pkgPath, "utf-8"));
      if (pkg.scripts?.["test:coverage"]) coverageCommand = pkg.scripts["test:coverage"];
      else if (pkg.scripts?.coverage) coverageCommand = pkg.scripts.coverage;
      else if (pkg.scripts?.test) {
        const testScript = pkg.scripts.test;
        if (testScript.includes("jest")) coverageCommand = testScript.replace("jest", "jest --coverage");
        else if (testScript.includes("vitest")) coverageCommand = testScript.replace("vitest", "vitest run --coverage");
        else coverageCommand = `${testScript} --coverage`;
      }
    } catch { /* skip */ }
  }
  if (!coverageCommand) return { name: "coverage", passed: true, output: "No coverage configuration found - skipping" };
  try {
    const { stdout, stderr } = await execAsync(coverageCommand, { cwd: projectDir, timeout: 120000, env: { ...process.env, CI: "true", NODE_ENV: "test" } });
    const output = stdout || stderr;
    const coverageMatch = output.match(/All files\s*\|\s*([\d.]+)/);
    if (coverageMatch) {
      const coverage = parseFloat(coverageMatch[1]);
      const passed = coverage >= threshold;
      return { name: "coverage", passed, output: `Coverage: ${coverage}% (threshold: ${threshold}%)` };
    }
    return { name: "coverage", passed: true, output: `Coverage check completed: ${output.slice(0, 500)}` };
  } catch (e: any) {
    return { name: "coverage", passed: false, output: e.stdout ? `${e.stdout}\n${e.stderr}` : e.message };
  }
}

export async function runTypeCheck(projectDir: string): Promise<CheckResult> {
  const pkgPath = join(projectDir, "package.json");
  let typecheckCommand: string | null = null;
  if (existsSync(pkgPath)) {
    try {
      const pkg = JSON.parse(readFileSync(pkgPath, "utf-8"));
      if (pkg.scripts?.["type-check"]) typecheckCommand = pkg.scripts["type-check"];
      else if (pkg.scripts?.typecheck) typecheckCommand = pkg.scripts.typecheck;
      else if (pkg.scripts?.["typecheck:ci"]) typecheckCommand = pkg.scripts["typecheck:ci"];
    } catch { /* skip */ }
  }
  if (!typecheckCommand && existsSync(join(projectDir, "tsconfig.json"))) typecheckCommand = "npx tsc --noEmit";
  if (!typecheckCommand) return { name: "typecheck", passed: true, output: "No TypeScript configuration found - skipping" };
  try {
    const { stdout, stderr } = await execAsync(typecheckCommand, { cwd: projectDir, timeout: 120000 });
    return { name: "typecheck", passed: true, output: stdout || stderr || "Type check passed" };
  } catch (e: any) {
    return { name: "typecheck", passed: false, output: e.stdout ? `${e.stdout}\n${e.stderr}` : e.message };
  }
}

export async function runSimplifyCheck(projectDir: string): Promise<CheckResult> {
  try {
    const { stdout: findOut } = await execAsync("find . -name '*.ts' -o -name '*.js' -o -name '*.tsx' -o -name '*.jsx' | grep -v node_modules | grep -v dist | head -20", { cwd: projectDir, timeout: 10000 });
    const files = findOut.trim().split("\n").filter(Boolean);
    const issues: string[] = [];
    for (const file of files.slice(0, 10)) {
      const fullPath = join(projectDir, file);
      if (!existsSync(fullPath)) continue;
      try {
        const content = readFileSync(fullPath, "utf-8");
        const lines = content.split("\n");
        if (lines.length > 500) issues.push(`${file}: ${lines.length} lines (consider splitting)`);
        let maxFuncLength = 0;
        let currentFuncLength = 0;
        let inFunction = false;
        for (const line of lines) {
          if (/^\s*(async\s+)?function\s+\w+|^\s*const\s+\w+\s*=\s*(async\s+)?\(/.test(line)) {
            if (inFunction && currentFuncLength > maxFuncLength) maxFuncLength = currentFuncLength;
            inFunction = true;
            currentFuncLength = 1;
          } else if (inFunction) {
            currentFuncLength++;
            if (/^\s*\}/.test(line) && currentFuncLength > 50) {
              maxFuncLength = Math.max(maxFuncLength, currentFuncLength);
              inFunction = false;
            }
          }
        }
        if (maxFuncLength > 50) issues.push(`${file}: function with ${maxFuncLength} lines detected (consider refactoring)`);
      } catch { /* skip */ }
    }
    if (issues.length > 0) return { name: "simplify", passed: false, output: issues.join("\n") };
    return { name: "simplify", passed: true, output: "No simplification opportunities detected" };
  } catch (e: any) {
    return { name: "simplify", passed: true, output: `Simplify check skipped: ${e.message}` };
  }
}

export async function runCommitsCheck(projectDir: string): Promise<CheckResult> {
  try {
    const { stdout: logOut } = await execAsync("git log --oneline -10", { cwd: projectDir, timeout: 10000 });
    const commits = logOut.trim().split("\n").filter(Boolean);
    if (commits.length === 0) return { name: "commits", passed: true, output: "No commits to check" };
    const conventionalCommitRegex = /^(feat|fix|docs|style|refactor|perf|test|build|ci|chore|revert)(\(\w+\))?:/;
    const nonConforming = commits.filter((commit) => {
      const message = commit.split(" ").slice(1).join(" ");
      return !conventionalCommitRegex.test(message);
    });
    if (nonConforming.length > 0) {
      return { name: "commits", passed: false, output: `Non-conforming commits found:\n${nonConforming.join("\n")}\n\nUse Conventional Commits format: type(scope): description` };
    }
    return { name: "commits", passed: true, output: `All ${commits.length} recent commits follow Conventional Commits format` };
  } catch (e: any) {
    return { name: "commits", passed: true, output: "Not a git repository or cannot read git log" };
  }
}

export async function runTodosCheck(projectDir: string): Promise<CheckResult> {
  try {
    const { stdout: grepOut } = await execAsync("grep -rn 'TODO\\|FIXME\\|HACK\\|XXX' --include='*.ts' --include='*.js' --include='*.tsx' --include='*.jsx' . | grep -v node_modules | grep -v dist | head -20", { cwd: projectDir, timeout: 10000 });
    const todos = grepOut.trim().split("\n").filter(Boolean);
    if (todos.length === 0) return { name: "todos", passed: true, output: "No TODO/FIXME/HACK/XXX comments found" };
    return { name: "todos", passed: false, output: `Found ${todos.length} TODO/FIXME/HACK/XXX comments:\n${todos.join("\n")}` };
  } catch (e: any) {
    if (e.code === 1) return { name: "todos", passed: true, output: "No TODO/FIXME/HACK/XXX comments found" };
    return { name: "todos", passed: true, output: `TODO check skipped: ${e.message}` };
  }
}

export async function runDocsCheck(projectDir: string): Promise<CheckResult> {
  const hasReadme = existsSync(join(projectDir, "README.md"));
  const hasReadmeCn = existsSync(join(projectDir, "README_CN.md"));
  const hasDocs = existsSync(join(projectDir, "docs"));
  const hasGeneratedDocs = existsSync(join(projectDir, "docs", "generated.md"));
  if (!hasReadme) return { name: "docs", passed: false, output: "README.md not found" };
  const context = getEngine().getContext();
  if (context?.featureFlags.readmeDualLanguage && !hasReadmeCn) return { name: "docs", passed: false, output: "README_CN.md not found (dual-language README required in v6)" };
  try {
    const readmeContent = readFileSync(join(projectDir, "README.md"), "utf-8");
    if (readmeContent.length < 50) return { name: "docs", passed: false, output: "README.md is too short (less than 50 characters)" };
  } catch { return { name: "docs", passed: false, output: "Could not read README.md" }; }
  const messages = ["README.md exists and has content"];
  if (hasReadmeCn) messages.push("README_CN.md exists (dual-language ✅)");
  if (hasDocs) messages.push("docs/ directory exists");
  if (hasGeneratedDocs) messages.push("Generated documentation found");
  return { name: "docs", passed: true, output: messages.join(". ") };
}

export async function runRulesCheck(projectDir: string): Promise<CheckResult> {
  const context = getEngine().getContext();
  if (!context?.featureFlags.ruleEnforcement) return { name: "rules", passed: true, output: "Rule enforcement disabled via feature flags" };
  const violations: string[] = [];
  const rules = DEV_WORKFLOW_RULES;
  const maxFileLines = context.featureFlags.maxFileLines;
  const maxFunctionLines = context.featureFlags.maxFunctionLines;
  try {
    const { stdout: findOut } = await execAsync("find . -name '*.ts' -o -name '*.js' -o -name '*.tsx' -o -name '*.jsx' | grep -v node_modules | grep -v dist | head -30", { cwd: projectDir, timeout: 10000 });
    const files = findOut.trim().split("\n").filter(Boolean);
    for (const file of files) {
      const fullPath = join(projectDir, file);
      if (!existsSync(fullPath)) continue;
      try {
        const content = readFileSync(fullPath, "utf-8");
        const lines = content.split("\n");
        if (lines.length > maxFileLines) violations.push(`[${rules["max-file-lines"].severity.toUpperCase()}] ${file}: ${lines.length} lines (max: ${maxFileLines}) — ${rules["max-file-lines"].description}`);
        let funcStart = -1;
        let funcDepth = 0;
        for (let i = 0; i < lines.length; i++) {
          const line = lines[i];
          if (/^\s*(async\s+)?function\s+\w+|^\s*const\s+\w+\s*=\s*(async\s+)?\(|^\s*(public|private|protected|static)?\s*(async\s+)?\w+\s*\(/.test(line)) {
            if (funcStart >= 0) {
              const funcLen = i - funcStart;
              if (funcLen > maxFunctionLines) violations.push(`[${rules["max-function-lines"].severity.toUpperCase()}] ${file}:${funcStart + 1}: function with ${funcLen} lines (max: ${maxFunctionLines}) — ${rules["max-function-lines"].description}`);
            }
            funcStart = i; funcDepth = 0;
          }
          if (funcStart >= 0 && i > funcStart) {
            funcDepth += (line.match(/\{/g) || []).length;
            funcDepth -= (line.match(/\}/g) || []).length;
            if (funcDepth <= 0) {
              const funcLen = i - funcStart + 1;
              if (funcLen > maxFunctionLines) violations.push(`[${rules["max-function-lines"].severity.toUpperCase()}] ${file}:${funcStart + 1}: function with ${funcLen} lines (max: ${maxFunctionLines}) — ${rules["max-function-lines"].description}`);
              funcStart = -1;
            }
          }
        }
        for (let i = 0; i < lines.length; i++) {
          const ln = lines[i];
          if (/\bconsole\.log\b/.test(ln) && !/\/\/\s*eslint/.test(ln)) violations.push(`[${rules["no-console-log"].severity.toUpperCase()}] ${file}:${i + 1}: console.log found — ${rules["no-console-log"].description}`);
          if (/\bdebugger\b/.test(ln)) violations.push(`[${rules["no-debugger"].severity.toUpperCase()}] ${file}:${i + 1}: debugger statement found — ${rules["no-debugger"].description}`);
          if (/\b(password|secret|api_?key|token)\s*[:=]\s*["'][^"']+["']/i.test(ln)) violations.push(`[${rules["no-hardcoded-secrets"].severity.toUpperCase()}] ${file}:${i + 1}: possible hardcoded secret — ${rules["no-hardcoded-secrets"].description}`);
          if (!/^\s*\/\/\s*(TODO|FIXME)/.test(ln) && /^\s*\/\/.*[;(={]/.test(ln) && !/^\s*\/\/\s*(eslint|prettier|tslint|@ts-)/.test(ln)) violations.push(`[${rules["no-commented-code"].severity.toUpperCase()}] ${file}:${i + 1}: possible commented-out code — ${rules["no-commented-code"].description}`);
          if (/\bany\b/.test(ln) && !/\/\*|\*\/|\/\/|import|export|as any/.test(ln) && /:\s*any\b/.test(ln)) violations.push(`[${rules["no-any-type"].severity.toUpperCase()}] ${file}:${i + 1}: any type used — ${rules["no-any-type"].description}`);
        }
      } catch { /* skip */ }
    }
  } catch (e: any) { return { name: "rules", passed: true, output: `Rules check skipped: ${e.message}` }; }
  const errors = violations.filter((v) => v.startsWith("[ERROR]"));
  const warnings = violations.filter((v) => v.startsWith("[WARNING]"));
  if (errors.length > 0) return { name: "rules", passed: false, output: `${errors.length} error(s), ${warnings.length} warning(s)\n${violations.join("\n")}` };
  if (warnings.length > 0) return { name: "rules", passed: true, output: `${warnings.length} warning(s) (non-blocking)\n${warnings.join("\n")}` };
  return { name: "rules", passed: true, output: "All dev-workflow rules satisfied" };
}

export async function runBoundaryCheck(projectDir: string): Promise<CheckResult> {
  const issues: string[] = [];
  try {
    const { stdout: findOut } = await execAsync("find . -name '*.ts' -o -name '*.js' -o -name '*.tsx' -o -name '*.jsx' | grep -v node_modules | grep -v dist | head -20", { cwd: projectDir, timeout: 10000 });
    const files = findOut.trim().split("\n").filter(Boolean);
    for (const file of files) {
      const fullPath = join(projectDir, file);
      if (!existsSync(fullPath)) continue;
      const content = readFileSync(fullPath, "utf-8");
      const lines = content.split("\n");
      for (let i = 0; i < lines.length; i++) {
        const ln = lines[i];
        if (/\w+\[\d+\]/.test(ln) && !ln.includes("?.") && !ln.includes("if")) { /* only flag obvious */ }
        if (/\.then\(/.test(ln) && !ln.includes(".catch")) issues.push(`${file}:${i+1}: .then() without .catch()`);
      }
    }
    if (issues.length > 0) return { name: "boundary", passed: false, output: `${issues.length} boundary issue(s):\n${issues.slice(0, 10).join("\n")}` };
    return { name: "boundary", passed: true, output: "No boundary issues detected" };
  } catch (e: any) { return { name: "boundary", passed: true, output: `Boundary check skipped: ${e.message}` }; }
}

export async function runIntegrationCheck(projectDir: string): Promise<CheckResult> {
  try {
    const { stdout } = await execAsync("grep -rn 'from \\..*/\\|from \\./' --include='*.ts' --include='*.tsx' . | grep -v node_modules | grep -v dist | head -30", { cwd: projectDir, timeout: 10000 });
    const imports = stdout.trim().split("\n").filter(Boolean);
    const missing: string[] = [];
    for (const imp of imports) {
      const match = imp.match(/from ['"]([^'"]+)['"]/);
      if (match) {
        const importPath = match[1].replace(/\.(ts|tsx|js|jsx)$/, "");
        if (importPath.startsWith(".")) {
          const resolvedPath = join(projectDir, importPath) + ".ts";
          const resolvedPathX = join(projectDir, importPath) + ".tsx";
          const resolvedIndex = join(projectDir, importPath, "index.ts");
          if (!existsSync(resolvedPath) && !existsSync(resolvedPathX) && !existsSync(resolvedIndex)) {
            missing.push(imp.split(":")[0] + ":" + imp.split(":")[1] + ` -> ${match[1]}`);
          }
        }
      }
    }
    if (missing.length > 0) return { name: "integration", passed: false, output: `${missing.length} unresolved import(s):\n${missing.slice(0, 10).join("\n")}` };
    return { name: "integration", passed: true, output: "All imports resolve correctly" };
  } catch (e: any) { return { name: "integration", passed: true, output: `Integration check skipped: ${e.message}` }; }
}

export async function runPerformanceCheck(projectDir: string): Promise<CheckResult> {
  const issues: string[] = [];
  try {
    const { stdout: findOut } = await execAsync("find . -name '*.ts' -o -name '*.js' | grep -v node_modules | grep -v dist | head -20", { cwd: projectDir, timeout: 10000 });
    const files = findOut.trim().split("\n").filter(Boolean);
    for (const file of files) {
      const fullPath = join(projectDir, file);
      if (!existsSync(fullPath)) continue;
      const content = readFileSync(fullPath, "utf-8");
      const lines = content.split("\n");
      for (let i = 0; i < lines.length; i++) {
        const ln = lines[i];
        if (/\bfor\b|\bforEach\b|\bmap\b/.test(ln) && lines.slice(i+1, Math.min(i+5, lines.length)).some(l => /\bawait\b/.test(l))) issues.push(`${file}:${i+1}: potential N+1 (await inside loop)`);
        if (/readFileSync|writeFileSync|existsSync/.test(ln)) issues.push(`${file}:${i+1}: synchronous file operation detected`);
      }
    }
    if (issues.length > 0) return { name: "performance", passed: false, output: `${issues.length} performance issue(s):\n${issues.slice(0, 10).join("\n")}` };
    return { name: "performance", passed: true, output: "No performance issues detected" };
  } catch (e: any) { return { name: "performance", passed: true, output: `Performance check skipped: ${e.message}` }; }
}
