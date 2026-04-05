import { Type } from "@sinclair/typebox";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import { exec } from "node:child_process";
import { promisify } from "node:util";

const execAsync = promisify(exec);

async function runGit(args: string[], cwd?: string): Promise<string> {
  const { stdout } = await execAsync(`git ${args.join(" ")}`, { cwd: cwd || process.cwd() });
  return stdout.trim();
}

async function runGitSafe(args: string[], cwd?: string): Promise<string | null> {
  try {
    return await runGit(args, cwd);
  } catch {
    return null;
  }
}

interface GitStatusInfo {
  branch: string;
  tracking: string;
  ahead: number;
  behind: number;
  staged: GitFileChange[];
  unstaged: GitFileChange[];
  untracked: string[];
  stashes: number;
}

interface GitFileChange {
  status: string;
  file: string;
  oldFile?: string;
}

interface CommitStats {
  total: number;
  byType: Record<string, number>;
  lastWeek: number;
  lastMonth: number;
  topAuthors: { name: string; count: number }[];
}

async function getGitStatus(cwd?: string): Promise<GitStatusInfo> {
  const branch = (await runGitSafe(["branch", "--show-current"], cwd)) || "HEAD (detached)";
  const tracking = await runGitSafe(["rev-parse", "--abbrev-ref", "@{upstream}"], cwd) || "(none)";

  let ahead = 0;
  let behind = 0;
  if (tracking !== "(none)") {
    const revList = await runGitSafe(["rev-list", "--left-right", "--count", `HEAD...@{upstream}`], cwd);
    if (revList) {
      const [a, b] = revList.split("\t").map(Number);
      ahead = a || 0;
      behind = b || 0;
    }
  }

  const stagedRaw = await runGitSafe(["diff", "--cached", "--name-status"], cwd) || "";
  const unstagedRaw = await runGitSafe(["diff", "--name-status"], cwd) || "";
  const untrackedRaw = await runGitSafe(["ls-files", "--others", "--exclude-standard"], cwd) || "";

  const parseChanges = (raw: string): GitFileChange[] =>
    raw.split("\n").filter(Boolean).map((line) => {
      const [status, ...rest] = line.split("\t");
      return { status, file: rest[0], oldFile: rest[1] };
    });

  const stashesRaw = await runGitSafe(["stash", "list"], cwd) || "";
  const stashes = stashesRaw ? stashesRaw.split("\n").length : 0;

  return {
    branch,
    tracking,
    ahead,
    behind,
    staged: parseChanges(stagedRaw),
    unstaged: parseChanges(unstagedRaw),
    untracked: untrackedRaw.split("\n").filter(Boolean),
    stashes,
  };
}

async function getCommitStats(cwd?: string, days = 30): Promise<CommitStats> {
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
  const log = await runGitSafe(["log", `--since=${since}`, "--pretty=format:%s%n%an"], cwd) || "";
  const lines = log.split("\n").filter(Boolean);

  const messages: string[] = [];
  const authors: string[] = [];
  for (let i = 0; i < lines.length; i += 2) {
    messages.push(lines[i]);
    if (lines[i + 1]) authors.push(lines[i + 1]);
  }

  const byType: Record<string, number> = {};
  for (const msg of messages) {
    const type = msg.match(/^(\w+)(?:\([^)]*\))?:/)?.[1] || "other";
    byType[type] = (byType[type] || 0) + 1;
  }

  const authorCounts: Record<string, number> = {};
  for (const a of authors) {
    authorCounts[a] = (authorCounts[a] || 0) + 1;
  }
  const topAuthors = Object.entries(authorCounts)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5)
    .map(([name, count]) => ({ name, count }));

  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
  const weekLog = await runGitSafe(["log", `--since=${weekAgo}`, "--oneline"], cwd) || "";
  const lastWeek = weekLog ? weekLog.split("\n").filter(Boolean).length : 0;

  return {
    total: messages.length,
    byType,
    lastWeek,
    lastMonth: messages.length,
    topAuthors,
  };
}

function generateConventionalMessage(type: string, scope: string | undefined, description: string, breaking: boolean): string {
  let msg = type;
  if (scope) msg += `(${scope})`;
  if (breaking) msg += "!";
  msg += `: ${description}`;
  return msg;
}

function detectCommitType(files: GitFileChange[]): string {
  const hasNewFile = files.some((f) => f.status === "A");
  const hasModified = files.some((f) => f.status === "M");
  const hasDeleted = files.some((f) => f.status === "D");
  const hasRenamed = files.some((f) => f.status === "R");

  if (hasNewFile) return "feat";
  if (hasDeleted) return "chore";
  if (hasRenamed) return "refactor";
  if (hasModified) {
    const testFiles = files.filter((f) => f.file.includes("test") || f.file.includes("spec"));
    if (testFiles.length === files.length) return "test";
    const docFiles = files.filter((f) => f.file.endsWith(".md") || f.file.endsWith(".txt"));
    if (docFiles.length === files.length) return "docs";
    return "fix";
  }
  return "chore";
}

async function getBranches(cwd?: string): Promise<{ current: string; branches: string[] }> {
  const raw = await runGit(["branch", "-a"], cwd);
  const branches = raw.split("\n").map((l) => l.replace(/^\*\s+/, "").trim()).filter(Boolean);
  const current = (await runGitSafe(["branch", "--show-current"], cwd)) || "";
  return { current, branches };
}

async function getRecentCommits(count = 20, cwd?: string): Promise<{ hash: string; message: string; author: string; date: string }[]> {
  const raw = await runGit(["log", `-${count}`, "--pretty=format:%h|%s|%an|%ai"], cwd);
  return raw.split("\n").filter(Boolean).map((line) => {
    const [hash, message, author, date] = line.split("|");
    return { hash, message, author, date };
  });
}

export function registerGitflow(api: any) {

    api.registerTool({
      name: "oh_gitflow_smart_commit",
      label: "Smart Commit",

      parameters: Type.Object({
        message: Type.String({ description: "Commit description (without type prefix)" }),
        type: Type.Optional(Type.String({ description: "Conventional commit type: feat, fix, docs, style, refactor, test, chore, perf, ci, build, revert" })),
        scope: Type.Optional(Type.String({ description: "Optional scope (e.g., 'auth', 'api', 'ui')" })),
        body: Type.Optional(Type.String({ description: "Optional commit body (detailed explanation)" })),
        breaking: Type.Optional(Type.Boolean({ description: "Mark as a breaking change" })),
        co_authors: Type.Optional(Type.Array(Type.String(), { description: "Co-author emails for trailers" })),
        dry_run: Type.Optional(Type.Boolean({ description: "Show the commit message without actually committing" })),
      }),
      async execute(_toolCallId: string, params: any) {
        const status = await getGitStatus();
        const allChanges = [...status.staged, ...status.unstaged];

        let type = params.type;
        if (!type) {
          type = allChanges.length > 0 ? detectCommitType(allChanges) : "chore";
        }

        const commitMsg = generateConventionalMessage(type, params.scope, params.message, !!params.breaking);
        let fullMessage = commitMsg;
        if (params.body) {
          fullMessage += `\n\n${params.body}`;
        }
        if (params.co_authors && params.co_authors.length > 0) {
          fullMessage += "\n\n" + params.co_authors.map((email: string) => `Co-authored-by: <${email}>`).join("\n");
        }

        if (params.dry_run) {
          return {
            content: [{ type: "text" as const, text: `[DRY RUN] Commit message would be:\n\n${fullMessage}\n\nStaged files: ${status.staged.length}\nUnstaged files: ${status.unstaged.length}\nUntracked files: ${status.untracked.length}` }],
            details: { success: true, message: fullMessage },
          };
        }

        if (status.staged.length === 0 && status.unstaged.length === 0 && status.untracked.length === 0) {
          return { content: [{ type: "text" as const, text: "No changes to commit. Working tree is clean." }], details: { success: true } };
        }

        try {
          if (status.unstaged.length > 0) {
            await runGit(["add", "-A"]);
          }
          if (status.untracked.length > 0) {
            await runGit(["add", ...status.untracked]);
          }
          await runGit(["commit", "-m", fullMessage]);
          const hash = await runGit(["log", "-1", "--format=%h"]);
          return { content: [{ type: "text" as const, text: `Committed: ${hash}\n${fullMessage}` }], details: { success: true, hash, message: fullMessage } };
        } catch (err: any) {
          return { content: [{ type: "text" as const, text: `Commit failed: ${err.message}` }], details: { success: false } };
        }
      },
    });

    api.registerTool({
      name: "oh_gitflow_branch_manager",
      label: "Branch Manager",

      parameters: Type.Object({
        action: Type.String({ description: "Action to perform", enum: ["list", "create", "delete", "rename", "switch", "track", "cleanup"] }),
        name: Type.Optional(Type.String({ description: "Branch name (for create, delete, rename, switch)" })),
        new_name: Type.Optional(Type.String({ description: "New branch name (for rename)" })),
        type: Type.Optional(Type.String({ description: "Branch type prefix", enum: ["feature", "fix", "bugfix", "hotfix", "release", "chore", "docs", "refactor"] })),
        from: Type.Optional(Type.String({ description: "Create branch from this commit/branch (default: current HEAD)" })),
        set_upstream: Type.Optional(Type.String({ description: "Set upstream to this remote branch (for track action)" })),
        dry_run: Type.Optional(Type.Boolean({ description: "Show what would happen without making changes" })),
      }),
      async execute(_toolCallId: string, params: any) {
        const { branches, current } = await getBranches();

        switch (params.action) {
          case "list": {
            const localBranches = branches.filter((b) => !b.includes("remotes/"));
            const remoteBranches = branches.filter((b) => b.startsWith("remotes/"));
            let output = `## Branches\n\n**Current:** ${current || "(detached HEAD)"}\n\n`;
            output += `### Local (${localBranches.length})\n${localBranches.map((b) => b === current ? `* ${b}` : `  ${b}`).join("\n")}\n\n`;
            output += `### Remote (${remoteBranches.length})\n${remoteBranches.slice(0, 20).map((b) => `  ${b}`).join("\n")}${remoteBranches.length > 20 ? "\n  ... and more" : ""}`;
            return { content: [{ type: "text" as const, text: output }], details: { success: true, current, local: localBranches.length, remote: remoteBranches.length } };
          }

          case "create": {
            if (!params.name) {
              return { content: [{ type: "text" as const, text: "Branch name required for create action. Use the 'name' parameter." }], details: { success: false } };
            }
            let branchName = params.name;
            if (params.type && !branchName.includes("/")) {
              branchName = `${params.type}/${branchName}`;
            }
            if (params.dry_run) {
              return { content: [{ type: "text" as const, text: `[DRY RUN] Would create branch: ${branchName}${params.from ? ` from ${params.from}` : ""}` }], details: { success: true } };
            }
            try {
              const fromArgs = params.from ? [params.from] : [];
              await runGit(["branch", branchName, ...fromArgs]);
              return { content: [{ type: "text" as const, text: `Branch created: ${branchName}${params.from ? ` (from ${params.from})` : ""}\n\nUse oh_git_branch_manager with action=switch to check it out.` }], details: { success: true, branch: branchName } };
            } catch (err: any) {
              return { content: [{ type: "text" as const, text: `Failed to create branch: ${err.message}` }], details: { success: false } };
            }
          }

          case "delete": {
            if (!params.name) {
              return { content: [{ type: "text" as const, text: "Branch name required for delete action." }], details: { success: false } };
            }
            if (params.dry_run) {
              return { content: [{ type: "text" as const, text: `[DRY RUN] Would delete branch: ${params.name}` }], details: { success: true } };
            }
            try {
              await runGit(["branch", "-d", params.name]);
              return { content: [{ type: "text" as const, text: `Branch deleted: ${params.name}` }], details: { success: true } };
            } catch {
              try {
                await runGit(["branch", "-D", params.name]);
                return { content: [{ type: "text" as const, text: `Branch force-deleted: ${params.name}` }], details: { success: true } };
              } catch (err: any) {
                return { content: [{ type: "text" as const, text: `Failed to delete branch: ${err.message}` }], details: { success: false } };
              }
            }
          }

          case "rename": {
            if (!params.name || !params.new_name) {
              return { content: [{ type: "text" as const, text: "Both 'name' and 'new_name' required for rename action." }], details: { success: false } };
            }
            if (params.dry_run) {
              return { content: [{ type: "text" as const, text: `[DRY RUN] Would rename: ${params.name} → ${params.new_name}` }], details: { success: true } };
            }
            try {
              await runGit(["branch", "-m", params.name, params.new_name]);
              return { content: [{ type: "text" as const, text: `Branch renamed: ${params.name} → ${params.new_name}` }], details: { success: true } };
            } catch (err: any) {
              return { content: [{ type: "text" as const, text: `Failed to rename branch: ${err.message}` }], details: { success: false } };
            }
          }

          case "switch": {
            if (!params.name) {
              return { content: [{ type: "text" as const, text: "Branch name required for switch action." }], details: { success: false } };
            }
            if (params.dry_run) {
              return { content: [{ type: "text" as const, text: `[DRY RUN] Would switch to: ${params.name}` }], details: { success: true } };
            }
            try {
              await runGit(["checkout", params.name]);
              return { content: [{ type: "text" as const, text: `Switched to branch: ${params.name}` }], details: { success: true } };
            } catch (err: any) {
              return { content: [{ type: "text" as const, text: `Failed to switch branch: ${err.message}\n\nAvailable branches: ${branches.filter((b) => !b.includes("remotes/")).join(", ")}` }], details: { success: false } };
            }
          }

          case "track": {
            if (!params.name || !params.set_upstream) {
              return { content: [{ type: "text" as const, text: "Both 'name' and 'set_upstream' required for track action." }], details: { success: false } };
            }
            try {
              await runGit(["branch", "--set-upstream-to", params.set_upstream, params.name]);
              return { content: [{ type: "text" as const, text: `Branch ${params.name} now tracks ${params.set_upstream}` }], details: { success: true } };
            } catch (err: any) {
              return { content: [{ type: "text" as const, text: `Failed to set upstream: ${err.message}` }], details: { success: false } };
            }
          }

          case "cleanup": {
            const merged = await runGitSafe(["branch", "--merged"]) || "";
            const toDelete = merged.split("\n").map((l) => l.trim().replace(/^\*\s+/, "")).filter((b) => b && b !== current && b !== "main" && b !== "master" && b !== "develop");
            if (toDelete.length === 0) {
              return { content: [{ type: "text" as const, text: "No merged branches to clean up." }], details: { success: true } };
            }
            if (params.dry_run) {
              return { content: [{ type: "text" as const, text: `[DRY RUN] Would delete these merged branches:\n${toDelete.map((b) => `  - ${b}`).join("\n")}` }], details: { success: true, branches: toDelete } };
            }
            const deleted: string[] = [];
            for (const b of toDelete) {
              try {
                await runGit(["branch", "-d", b]);
                deleted.push(b);
              } catch { /* skip */ }
            }
            return { content: [{ type: "text" as const, text: `Cleaned up ${deleted.length} merged branches:\n${deleted.map((b) => `  ✓ ${b}`).join("\n")}` }], details: { success: true, deleted } };
          }

          default:
            return { content: [{ type: "text" as const, text: `Unknown action: ${params.action}. Use: list, create, delete, rename, switch, track, cleanup` }], details: { success: false } };
        }
      },
    });

    api.registerTool({
      name: "oh_gitflow_pr_description",
      label: "PR Description Generator",

      parameters: Type.Object({
        target: Type.Optional(Type.String({ description: "Target branch to compare against (default: main)" })),
        include_diff: Type.Optional(Type.Boolean({ description: "Include a summary of file changes" })),
        include_checklist: Type.Optional(Type.Boolean({ description: "Include a PR checklist" })),
        format: Type.Optional(Type.String({ description: "Output format", enum: ["markdown", "json"], default: "markdown" })),
      }),
      async execute(_toolCallId: string, params: any) {
        const target = params.target || "main";
        const current = (await runGitSafe(["branch", "--show-current"])) || "HEAD";

        if (current === target || current === "HEAD (detached)") {
          return { content: [{ type: "text" as const, text: `Cannot generate PR from '${current}' to '${target}'. You may be on the target branch or in detached HEAD.` }], details: { success: false } };
        }

        const commits = await getRecentCommits(50);
        const branchCommits = commits.filter((c) => !c.message.includes(`Merge branch '${target}'`));

        const types: Record<string, string[]> = {};
        for (const c of branchCommits) {
          const type = c.message.match(/^(\w+)(?:\([^)]*\))?:/)?.[1] || "other";
          if (!types[type]) types[type] = [];
          types[type].push(c.message);
        }

        let changesSection = "";
        if (params.include_diff) {
          const diffStat = await runGitSafe(["diff", "--stat", target]) || "";
          if (diffStat) {
            changesSection = `\n## Changes\n\`\`\`\n${diffStat}\n\`\`\`\n`;
          }
        }

        let checklistSection = "";
        if (params.include_checklist) {
          checklistSection = `\n## Checklist\n\n- [ ] Tests added/updated\n- [ ] Documentation updated\n- [ ] Breaking changes noted\n- [ ] Code reviewed\n- [ ] Self-review completed`;
        }

        let body = `## Pull Request: ${current} → ${target}\n\n`;
        body += `### Summary\n<!-- Brief description of changes -->\n\n`;

        for (const [type, messages] of Object.entries(types)) {
          const emoji = type === "feat" ? "✨" : type === "fix" ? "🐛" : type === "docs" ? "📝" : type === "refactor" ? "♻️" : type === "test" ? "🧪" : type === "chore" ? "🔧" : "📦";
          body += `### ${emoji} ${type.charAt(0).toUpperCase() + type.slice(1)}\n`;
          for (const msg of messages) {
            const clean = msg.replace(/^\w+(?:\([^)]*\))?!?:\s*/, "");
            body += `- ${clean}\n`;
          }
          body += "\n";
        }

        body += changesSection;
        body += checklistSection;

        if (params.format === "json") {
          return {
            content: [{ type: "text" as const, text: JSON.stringify({ title: `${current} → ${target}`, body }, null, 2) }],
            details: { success: true, commitCount: branchCommits.length },
          };
        }

        return {
          content: [{ type: "text" as const, text: body }],
          details: { success: true, commitCount: branchCommits.length, types: Object.keys(types) },
        };
      },
    });

    api.registerTool({
      name: "oh_gitflow_changelog",
      label: "Changelog Generator",

      parameters: Type.Object({
        from: Type.Optional(Type.String({ description: "Start tag or date (e.g., 'v1.0.0' or '2024-01-01')" })),
        to: Type.Optional(Type.String({ description: "End tag or date (default: HEAD)" })),
        types: Type.Optional(Type.Array(Type.String(), { description: "Commit types to include (default: feat, fix, perf, refactor)" })),
        format: Type.Optional(Type.String({ description: "Output format", enum: ["markdown", "json", "text"], default: "markdown" })),
        max_entries: Type.Optional(Type.Number({ description: "Maximum changelog entries (default: 100)" })),
      }),
      async execute(_toolCallId: string, params: any) {
        const types = params.types || ["feat", "fix", "perf", "refactor"];
        const maxEntries = params.max_entries || 100;

        let logArgs = ["log", "--pretty=format:%h|%s|%an|%ai"];
        if (params.from) {
          logArgs.push(`${params.from}..${params.to || "HEAD"}`);
        } else if (params.to) {
          logArgs.push(`--since=${params.to}`);
        }

        const raw = await runGitSafe(logArgs) || "";
        const entries = raw.split("\n").filter(Boolean).slice(0, maxEntries).map((line) => {
          const [hash, message, author, date] = line.split("|");
          const typeMatch = message.match(/^(\w+)(?:\(([^)]+)\))?!?:\s*(.+)/);
          return {
            hash,
            message,
            author,
            date,
            type: typeMatch ? typeMatch[1] : "other",
            scope: typeMatch ? typeMatch[2] || undefined : undefined,
            description: typeMatch ? typeMatch[3] : message,
          };
        });

        const filtered = entries.filter((e) => types.includes(e.type));
        const grouped: Record<string, typeof entries> = {};
        for (const entry of filtered) {
          if (!grouped[entry.type]) grouped[entry.type] = [];
          grouped[entry.type].push(entry);
        }

        if (params.format === "json") {
          return { content: [{ type: "text" as const, text: JSON.stringify(grouped, null, 2) }], details: { success: true, total: filtered.length } };
        }

        if (params.format === "text") {
          const text = filtered.map((e) => `${e.hash} ${e.message} (${e.author}, ${e.date.split("T")[0]})`).join("\n");
          return { content: [{ type: "text" as const, text: text }], details: { success: true, total: filtered.length } };
        }

        let output = "# Changelog\n\n";
        if (params.from) {
          output += `## ${params.from} → ${params.to || "HEAD"}\n\n`;
        }

        const typeLabels: Record<string, string> = { feat: "✨ Features", fix: "🐛 Bug Fixes", perf: "⚡ Performance", refactor: "♻️ Refactoring", docs: "📝 Documentation", test: "🧪 Tests", chore: "🔧 Chores", ci: "👷 CI/CD", build: "📦 Build", revert: "⏪ Reverts" };

        for (const type of types) {
          const items = grouped[type];
          if (!items || items.length === 0) continue;
          output += `### ${typeLabels[type] || type}\n\n`;
          for (const item of items) {
            const scope = item.scope ? `**${item.scope}:** ` : "";
            output += `- ${scope}${item.description} (\`${item.hash}\`)\n`;
          }
          output += "\n";
        }

        const otherEntries = entries.filter((e) => !types.includes(e.type) && e.type !== "Merge");
        if (otherEntries.length > 0) {
          output += `### Other\n\n`;
          for (const item of otherEntries.slice(0, 10)) {
            output += `- ${item.message} (\`${item.hash}\`)\n`;
          }
        }

        output += `\n---\nTotal: ${filtered.length} entries from ${entries.length} commits`;

        return { content: [{ type: "text" as const, text: output }], details: { success: true, total: filtered.length } };
      },
    });

    api.registerTool({
      name: "oh_gitflow_worktree",
      label: "Worktree Manager",

      parameters: Type.Object({
        action: Type.String({ description: "Worktree action", enum: ["list", "add", "remove", "prune"] }),
        path: Type.Optional(Type.String({ description: "Worktree path (for add/remove)" })),
        branch: Type.Optional(Type.String({ description: "Branch to check out (for add)" })),
        detach: Type.Optional(Type.Boolean({ description: "Create detached HEAD worktree" })),
        dry_run: Type.Optional(Type.Boolean({ description: "Show what would happen without making changes" })),
      }),
      async execute(_toolCallId: string, params: any) {
        switch (params.action) {
          case "list": {
            const raw = await runGit(["worktree", "list", "--porcelain"]);
            const worktrees: { path: string; hash: string; branch: string; detached: boolean }[] = [];
            let current: Partial<typeof worktrees[0]> = {};
            for (const line of raw.split("\n")) {
              if (line.startsWith("worktree ")) {
                if (current.path) worktrees.push(current as typeof worktrees[0]);
                current = { path: line.replace("worktree ", "") };
              } else if (line.startsWith("HEAD ")) {
                current.hash = line.replace("HEAD ", "");
              } else if (line.startsWith("branch ")) {
                current.branch = line.replace("branch ", "").split("/").slice(3).join("/");
              } else if (line === "detached") {
                current.detached = true;
              }
            }
            if (current.path) worktrees.push(current as typeof worktrees[0]);

            let output = `## Worktrees (${worktrees.length})\n\n`;
            for (const wt of worktrees) {
              const isMain = wt.branch === "main" || wt.branch === "master";
              output += `${isMain ? "📍" : "🌳"} ${wt.path}\n`;
              output += `   Branch: ${wt.branch || (wt.detached ? `(detached @ ${wt.hash?.slice(0, 7)})` : "unknown")}\n\n`;
            }
            return { content: [{ type: "text" as const, text: output }], details: { success: true, count: worktrees.length } };
          }

          case "add": {
            if (!params.path || !params.branch) {
              return { content: [{ type: "text" as const, text: "Both 'path' and 'branch' required for add action." }], details: { success: false } };
            }
            if (params.dry_run) {
              return { content: [{ type: "text" as const, text: `[DRY RUN] Would create worktree at ${params.path} for branch ${params.branch}` }], details: { success: true } };
            }
            try {
              const args = ["worktree", "add", params.path];
              if (params.detach) {
                args.push("--detach");
              } else {
                args.push(params.branch);
              }
              await runGit(args);
              return { content: [{ type: "text" as const, text: `Worktree created: ${params.path}\nBranch: ${params.branch}` }], details: { success: true, path: params.path } };
            } catch (err: any) {
              return { content: [{ type: "text" as const, text: `Failed to create worktree: ${err.message}` }], details: { success: false } };
            }
          }

          case "remove": {
            if (!params.path) {
              return { content: [{ type: "text" as const, text: "'path' required for remove action." }], details: { success: false } };
            }
            if (params.dry_run) {
              return { content: [{ type: "text" as const, text: `[DRY RUN] Would remove worktree: ${params.path}` }], details: { success: true } };
            }
            try {
              await runGit(["worktree", "remove", params.path]);
              return { content: [{ type: "text" as const, text: `Worktree removed: ${params.path}` }], details: { success: true } };
            } catch (err: any) {
              return { content: [{ type: "text" as const, text: `Failed to remove worktree: ${err.message}` }], details: { success: false } };
            }
          }

          case "prune": {
            const before = await runGit(["worktree", "list", "--porcelain"]);
            if (params.dry_run) {
              return { content: [{ type: "text" as const, text: "[DRY RUN] Would prune missing worktrees" }], details: { success: true } };
            }
            try {
              await runGit(["worktree", "prune"]);
              const after = await runGit(["worktree", "list", "--porcelain"]);
              const pruned = before.split("\n").filter((l) => !after.includes(l)).length;
              return { content: [{ type: "text" as const, text: `Pruned ${pruned} missing worktrees` }], details: { success: true } };
            } catch (err: any) {
              return { content: [{ type: "text" as const, text: `Failed to prune: ${err.message}` }], details: { success: false } };
            }
          }

          default:
            return { content: [{ type: "text" as const, text: `Unknown action: ${params.action}. Use: list, add, remove, prune` }], details: { success: false } };
        }
      },
    });

    api.registerTool({
      name: "oh_gitflow_status_dashboard",
      label: "Git Status Dashboard",

      parameters: Type.Object({
        include_stats: Type.Optional(Type.Boolean({ description: "Include commit statistics" })),
        include_recent: Type.Optional(Type.Boolean({ description: "Include recent commits" })),
        recent_count: Type.Optional(Type.Number({ description: "Number of recent commits to show (default: 10)" })),
      }),
      async execute(_toolCallId: string, params: any) {
        const status = await getGitStatus();
        let output = `## Git Status Dashboard\n\n`;
        output += `### Branch: ${status.branch}\n`;
        if (status.tracking !== "(none)") {
          output += `Tracking: ${status.tracking}`;
          if (status.ahead > 0) output += ` (↑${status.ahead} ahead)`;
          if (status.behind > 0) output += ` (↓${status.behind} behind)`;
          output += "\n";
        }
        output += "\n";

        const totalChanges = status.staged.length + status.unstaged.length + status.untracked.length;
        output += `### Changes (${totalChanges})\n`;
        if (status.staged.length > 0) {
          output += `\n**Staged (${status.staged.length})**\n`;
          for (const c of status.staged) {
            const icon = c.status === "A" ? "➕" : c.status === "M" ? "✏️" : c.status === "D" ? "🗑️" : c.status.startsWith("R") ? "↔️" : c.status;
            output += `  ${icon} ${c.file}${c.oldFile ? ` (was ${c.oldFile})` : ""}\n`;
          }
        }
        if (status.unstaged.length > 0) {
          output += `\n**Unstaged (${status.unstaged.length})**\n`;
          for (const c of status.unstaged) {
            const icon = c.status === "M" ? "✏️" : c.status === "D" ? "🗑️" : c.status;
            output += `  ${icon} ${c.file}\n`;
          }
        }
        if (status.untracked.length > 0) {
          output += `\n**Untracked (${status.untracked.length})**\n`;
          for (const f of status.untracked.slice(0, 20)) {
            output += `  ❓ ${f}\n`;
          }
          if (status.untracked.length > 20) output += `  ... and ${status.untracked.length - 20} more\n`;
        }
        if (totalChanges === 0) {
          output += "Working tree is clean.\n";
        }

        output += `\n### Stashes: ${status.stashes}\n`;

        if (params.include_stats) {
          const stats = await getCommitStats();
          output += `\n### Commit Stats (last ${params.recent_count || 30} days)\n`;
          output += `Total commits: ${stats.total}\nThis week: ${stats.lastWeek}\n`;
          output += `By type: ${Object.entries(stats.byType).map(([t, c]) => `${t}: ${c}`).join(", ")}\n`;
          if (stats.topAuthors.length > 0) {
            output += `Top authors: ${stats.topAuthors.map((a) => `${a.name} (${a.count})`).join(", ")}\n`;
          }
        }

        if (params.include_recent) {
          const count = params.recent_count || 10;
          const commits = await getRecentCommits(count);
          output += `\n### Recent Commits\n`;
          for (const c of commits) {
            output += `${c.hash} ${c.message} (${c.date.split("T")[0]})\n`;
          }
        }

        return { content: [{ type: "text" as const, text: output }], details: { success: true, totalChanges, stashCount: status.stashes } };
      },
    });
  }
