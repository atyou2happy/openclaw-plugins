import type { PluginRuntime } from "openclaw/plugin-sdk/core";
import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

export async function gitPrepare(runtime: PluginRuntime, projectDir: string, taskName?: string): Promise<{ stashed: boolean; branch: string; created: boolean }> {
  const logger = runtime.logging.getChildLogger({ level: "info" });
  const result = { stashed: false, branch: "", created: false };
  try {
    const { stdout: isGit } = await execAsync("git rev-parse --is-inside-work-tree", { cwd: projectDir });
    if (isGit.trim() !== "true") { logger.info("Not a git repository, skipping git prepare"); return result; }
    const { stdout: currentBranch } = await execAsync("git rev-parse --abbrev-ref HEAD", { cwd: projectDir });
    result.branch = currentBranch.trim();
    const { stdout: status } = await execAsync("git status --porcelain", { cwd: projectDir });
    if (status.trim().length > 0) {
      logger.info("Uncommitted changes detected, stashing...");
      await execAsync("git stash push -m \"dwf-auto-stash\"", { cwd: projectDir });
      result.stashed = true;
    }
    if (result.branch.startsWith("feature/")) { logger.info(`Already on feature branch: ${result.branch}`); return result; }
    const date = new Date().toISOString().slice(0, 10).replace(/-/g, "");
    const safeName = (taskName || "workflow").replace(/[^a-zA-Z0-9-]/g, "-").slice(0, 30);
    const branchName = `feature/dwf-${date}-${safeName}`;
    await execAsync(`git checkout -b ${branchName}`, { cwd: projectDir });
    result.branch = branchName;
    result.created = true;
    logger.info(`Created feature branch: ${branchName}`);
  } catch (error) { logger.warn(`Git prepare failed: ${error}`); }
  return result;
}
