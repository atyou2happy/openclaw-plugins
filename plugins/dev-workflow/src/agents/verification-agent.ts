import type { PluginRuntime } from "openclaw/plugin-sdk/core";
import { exec } from "child_process";
import { promisify } from "util";
import { existsSync, readFileSync } from "fs";
import { join } from "path";

const execAsync = promisify(exec);

export interface VerificationReport {
  taskName: string;
  lint: CheckResult;
  tests: CheckResult;
  typeCheck: CheckResult;
  verdict: "PASS" | "FAIL";
  issues: string[];
  timestamp: string;
}

export interface CheckResult {
  passed: boolean;
  output: string;
  errors: number;
}

export class VerificationAgent {
  private runtime: PluginRuntime;

  constructor(runtime: PluginRuntime) {
    this.runtime = runtime;
  }

  async verify(taskName: string, projectDir: string, skipChecks?: string[]): Promise<VerificationReport> {
    const logger = this.runtime.logging.getChildLogger({ level: "info" });
    logger.info(`[VerificationAgent] Starting verification for task: ${taskName}${skipChecks?.length ? ` (skipping: ${skipChecks.join(",")})` : ""}`);

    // T6: Skip checks that already passed in gate checks (dedup)
    const skip = new Set(skipChecks ?? []);
    const lintResult = skip.has("lint") ? { passed: true, errors: 0, output: "Skipped (gate check passed)" } : await this.runLint(projectDir);
    const testsResult = skip.has("test") ? { passed: true, errors: 0, output: "Skipped (gate check passed)" } : await this.runTests(projectDir);
    const typeCheckResult = skip.has("typeCheck") ? { passed: true, errors: 0, output: "Skipped (gate check passed)" } : await this.runTypeCheck(projectDir);

    const issues: string[] = [];
    if (!lintResult.passed) issues.push(`Lint: ${lintResult.errors} error(s)`);
    if (!testsResult.passed) issues.push(`Tests: ${testsResult.output}`);
    if (!typeCheckResult.passed) issues.push(`TypeCheck: ${typeCheckResult.errors} error(s)`);

    const verdict: "PASS" | "FAIL" = lintResult.passed && testsResult.passed && typeCheckResult.passed ? "PASS" : "FAIL";

    const report: VerificationReport = {
      taskName,
      lint: lintResult,
      tests: testsResult,
      typeCheck: typeCheckResult,
      verdict,
      issues,
      timestamp: new Date().toISOString(),
    };

    logger.info(`[VerificationAgent] Verdict: ${verdict} for task: ${taskName}`);
    return report;
  }

  formatReport(report: VerificationReport): string {
    const lines = [
      `[Verification Report: ${report.taskName}]`,
      `Lint: ${report.lint.passed ? "✅ passed" : `❌ ${report.lint.errors} error(s)`}`,
      `Tests: ${report.tests.passed ? `✅ ${report.tests.output || "passed"}` : `❌ ${report.tests.output}`}`,
      `TypeCheck: ${report.typeCheck.passed ? "✅ passed" : `❌ ${report.typeCheck.errors} error(s)`}`,
    ];

    if (report.issues.length > 0) {
      lines.push("Issues:");
      for (const issue of report.issues) lines.push(`  - ${issue}`);
    }

    lines.push(`Verdict: ${report.verdict}`);
    lines.push(`[/Verification Report]`);
    return lines.join("\n");
  }

  private async runLint(projectDir: string): Promise<CheckResult> {
    const pkgPath = join(projectDir, "package.json");
    let cmd: string | null = null;

    if (existsSync(pkgPath)) {
      try {
        const pkg = JSON.parse(readFileSync(pkgPath, "utf-8"));
        if (pkg.scripts?.lint) cmd = pkg.scripts.lint;
        else if (pkg.scripts?.["lint:ci"]) cmd = pkg.scripts["lint:ci"];
      } catch { /* skip */ }
    }

    if (!cmd) {
      if (existsSync(join(projectDir, ".eslintrc.js")) || existsSync(join(projectDir, "eslint.config.js")) || existsSync(join(projectDir, "eslint.config.mjs"))) {
        cmd = "npx eslint . --max-warnings=0";
      } else if (existsSync(join(projectDir, "ruff.toml")) || existsSync(join(projectDir, "pyproject.toml"))) {
        cmd = "ruff check .";
      }
    }

    if (!cmd) return { passed: true, output: "No lint config found", errors: 0 };

    try {
      const { stdout, stderr } = await execAsync(cmd, { cwd: projectDir, timeout: 60000 });
      return { passed: true, output: (stdout || stderr || "Lint passed").trim(), errors: 0 };
    } catch (e: any) {
      const output = e.stdout ? `${e.stdout}\n${e.stderr}` : e.message;
      const errorCount = this.countErrors(output);
      return { passed: false, output: output.trim(), errors: errorCount };
    }
  }

  private async runTests(projectDir: string): Promise<CheckResult> {
    const pkgPath = join(projectDir, "package.json");
    let cmd = "npm test";

    if (existsSync(pkgPath)) {
      try {
        const pkg = JSON.parse(readFileSync(pkgPath, "utf-8"));
        if (pkg.scripts?.test) cmd = pkg.scripts.test;
        else if (existsSync(join(projectDir, "vitest.config.js")) || existsSync(join(projectDir, "vitest.config.ts"))) cmd = "npx vitest run --passWithNoTests";
        else if (existsSync(join(projectDir, "jest.config.js")) || existsSync(join(projectDir, "jest.config.ts"))) cmd = "npx jest --passWithNoTests";
      } catch { /* skip */ }
    }

    if (existsSync(join(projectDir, "pytest.ini")) || existsSync(join(projectDir, "pyproject.toml"))) {
      cmd = "pytest -q --tb=short";
    }

    try {
      const { stdout, stderr } = await execAsync(cmd, { cwd: projectDir, timeout: 120000, env: { ...process.env, CI: "true", NODE_ENV: "test" } });
      return { passed: true, output: (stdout || stderr || "Tests passed").trim(), errors: 0 };
    } catch (e: any) {
      return { passed: false, output: (e.stdout ? `${e.stdout}\n${e.stderr}` : e.message).trim(), errors: 1 };
    }
  }

  private async runTypeCheck(projectDir: string): Promise<CheckResult> {
    const pkgPath = join(projectDir, "package.json");
    let cmd: string | null = null;

    if (existsSync(pkgPath)) {
      try {
        const pkg = JSON.parse(readFileSync(pkgPath, "utf-8"));
        if (pkg.scripts?.typecheck) cmd = pkg.scripts.typecheck;
        else if (pkg.scripts?.["type-check"]) cmd = pkg.scripts["type-check"];
        else if (pkg.scripts?.["typecheck:ci"]) cmd = pkg.scripts["typecheck:ci"];
      } catch { /* skip */ }
    }

    if (!cmd && existsSync(join(projectDir, "tsconfig.json"))) {
      cmd = "npx tsc --noEmit";
    }

    if (!cmd && (existsSync(join(projectDir, "mypy.ini")) || existsSync(join(projectDir, "pyproject.toml")))) {
      cmd = "mypy .";
    }

    if (!cmd) return { passed: true, output: "No TypeScript/Python type config found", errors: 0 };

    try {
      const { stdout, stderr } = await execAsync(cmd, { cwd: projectDir, timeout: 120000 });
      return { passed: true, output: (stdout || stderr || "Type check passed").trim(), errors: 0 };
    } catch (e: any) {
      const output = e.stdout ? `${e.stdout}\n${e.stderr}` : e.message;
      const errorCount = this.countErrors(output);
      return { passed: false, output: output.trim(), errors: errorCount };
    }
  }

  private countErrors(output: string): number {
    const matches = output.match(/\d+\s+error/g);
    if (matches) {
      return matches.reduce((sum, m) => {
        const n = parseInt(m, 10);
        return sum + (isNaN(n) ? 1 : n);
      }, 0);
    }
    const failMatches = output.match(/failed:\s*\d+/gi);
    if (failMatches) {
      return failMatches.reduce((sum, m) => {
        const n = parseInt(m.match(/\d+/)?.[0] || "1", 10);
        return sum + n;
      }, 0);
    }
    return output.trim().length > 0 ? 1 : 0;
  }
}
