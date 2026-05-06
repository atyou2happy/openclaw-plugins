import { exec } from "child_process";
import { promisify } from "util";
import { readFileSync, existsSync } from "fs";
import { join } from "path";

const execAsync = promisify(exec);

export async function runTests(projectDir: string): Promise<{ passed: boolean; output: string }> {
  const pkgPath = join(projectDir, "package.json");
  let cmd = "npm test";
  if (existsSync(pkgPath)) {
    try {
      const pkg = JSON.parse(readFileSync(pkgPath, "utf-8"));
      if (pkg.scripts?.test) cmd = pkg.scripts.test;
      else if (existsSync(join(projectDir, "vitest.config.js")) || existsSync(join(projectDir, "vitest.config.ts"))) cmd = "npx vitest run";
      else if (existsSync(join(projectDir, "jest.config.js")) || existsSync(join(projectDir, "jest.config.ts"))) cmd = "npx jest";
    } catch { /* skip */ }
  }
  try {
    const { stdout, stderr } = await execAsync(cmd, { cwd: projectDir, timeout: 120000, env: { ...process.env, CI: "true", NODE_ENV: "test" } });
    return { passed: true, output: stdout || stderr };
  } catch (e: any) {
    return { passed: false, output: e.stdout ? `${e.stdout}\n${e.stderr}` : e.message };
  }
}
