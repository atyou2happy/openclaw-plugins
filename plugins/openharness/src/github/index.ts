import { Type } from "@sinclair/typebox";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import * as crypto from "node:crypto";
import { exec } from "node:child_process";
import { promisify } from "node:util";

const execAsync = promisify(exec);

async function runGh(args: string[]): Promise<string> {
  const { stdout } = await execAsync(`gh ${args.join(" ")}`);
  return stdout.trim();
}

async function detectRepo(): Promise<string | null> {
  try {
    const { stdout } = await execAsync("git remote get-url origin");
    const match = stdout.trim().match(/github\.com[:/]([^/]+\/[^/]+?)(?:\.git)?$/);
    return match ? match[1] : null;
  } catch {
    return null;
  }
}

export function registerGithub(api: any) {

    api.registerTool({
      name: "oh_github_issue_create",
      label: "Create GitHub Issue",

      parameters: Type.Object({
        title: Type.String({ description: "Issue title" }),
        body: Type.String({ description: "Issue body (markdown)" }),
        labels: Type.Optional(Type.Array(Type.String(), { description: "Issue labels" })),
        assignees: Type.Optional(Type.Array(Type.String(), { description: "Assignees (GitHub usernames)" })),
        repo: Type.Optional(Type.String({ description: "Repository (owner/repo). Auto-detected from git remote if not set." })),
      }),
      async execute(_toolCallId: string, params: any) {
        const repo = params.repo || await detectRepo();
        if (!repo) {
          return { content: [{ type: "text" as const, text: "Could not detect GitHub repository. Set the 'repo' parameter or configure a git remote." }], details: { success: false } };
        }

        try {
          const args = ["issue", "create", "--repo", repo, "--title", `"${params.title}"`, "--body", `"${params.body.replace(/"/g, '\\"')}"`];
          if (params.labels) args.push("--label", params.labels.join(","));
          if (params.assignees) args.push("--assignee", params.assignees.join(","));

          const result = await runGh(args);
          const urlMatch = result.match(/(https:\/\/github\.com\/[^ ]+)/);
          const url = urlMatch ? urlMatch[1] : result;

          return { content: [{ type: "text" as const, text: `Issue created: ${params.title}\nURL: ${url}\nRepo: ${repo}\nLabels: ${params.labels?.join(", ") || "none"}\nAssignees: ${params.assignees?.join(", ") || "none"}` }], details: { success: true, url, repo } };
        } catch (err: any) {
          return { content: [{ type: "text" as const, text: `Failed to create issue: ${err.message}` }], details: { success: false } };
        }
      },
    });

    api.registerTool({
      name: "oh_github_issue_list",
      label: "List GitHub Issues",

      parameters: Type.Object({
        state: Type.Optional(Type.String({ description: "Issue state", enum: ["open", "closed", "all"], default: "open" })),
        labels: Type.Optional(Type.Array(Type.String(), { description: "Filter by labels" })),
        assignee: Type.Optional(Type.String({ description: "Filter by assignee" })),
        limit: Type.Optional(Type.Number({ description: "Maximum issues to list (default: 20)" })),
        repo: Type.Optional(Type.String({ description: "Repository (owner/repo)" })),
      }),
      async execute(_toolCallId: string, params: any) {
        const repo = params.repo || await detectRepo();
        if (!repo) {
          return { content: [{ type: "text" as const, text: "Could not detect GitHub repository." }], details: { success: false } };
        }

        try {
          const args = ["issue", "list", "--repo", repo, "--state", params.state || "open", "--limit", String(params.limit || 20), "--json", "number,title,state,labels,assignees,createdAt,author"];
          const json = await runGh(args);
          const issues = JSON.parse(json);

          if (issues.length === 0) {
            return { content: [{ type: "text" as const, text: `No ${params.state || "open"} issues in ${repo}` }], details: { success: true } };
          }

          let output = `## Issues in ${repo} (${params.state || "open"})\n\n`;
          for (const issue of issues) {
            const labels = issue.labels?.map((l: any) => typeof l === "string" ? l : l.name).join(", ") || "";
            const assignees = issue.assignees?.map((a: any) => a.login).join(", ") || "";
            output += `#${issue.number} **${issue.title}**\n`;
            output += `   State: ${issue.state} | Labels: ${labels || "none"} | Assignee: ${assignees || "unassigned"}\n`;
            output += `   Author: ${issue.author?.login || "unknown"} | Created: ${issue.createdAt}\n`;
            output += `   URL: https://github.com/${repo}/issues/${issue.number}\n\n`;
          }

          return { content: [{ type: "text" as const, text: output }], details: { success: true, count: issues.length } };
        } catch (err: any) {
          return { content: [{ type: "text" as const, text: `Failed to list issues: ${err.message}` }], details: { success: false } };
        }
      },
    });

    api.registerTool({
      name: "oh_github_issue_get",
      label: "Get GitHub Issue",

      parameters: Type.Object({
        number: Type.Number({ description: "Issue number" }),
        repo: Type.Optional(Type.String({ description: "Repository (owner/repo)" })),
        include_comments: Type.Optional(Type.Boolean({ description: "Include issue comments (default: true)" })),
      }),
      async execute(_toolCallId: string, params: any) {
        const repo = params.repo || await detectRepo();
        if (!repo) {
          return { content: [{ type: "text" as const, text: "Could not detect GitHub repository." }], details: { success: false } };
        }

        try {
          const issueJson = await runGh(["issue", "view", String(params.number), "--repo", repo, "--json", "number,title,body,state,labels,assignees,createdAt,author,url"]);
          const issue = JSON.parse(issueJson);

          let output = `## #${issue.number} ${issue.title}\n\n`;
          output += `State: ${issue.state} | Author: ${issue.author?.login || "unknown"}\n`;
          output += `Created: ${issue.createdAt}\n`;
          output += `Labels: ${issue.labels?.map((l: any) => typeof l === "string" ? l : l.name).join(", ") || "none"}\n\n`;
          output += `### Description\n\n${issue.body}\n\n`;

          if (params.include_comments !== false) {
            try {
              const commentsJson = await runGh(["issue", "view", String(params.number), "--repo", repo, "--comments", "--json", "comments"]);
              const comments = JSON.parse(commentsJson).comments || [];
              if (comments.length > 0) {
                output += `### Comments (${comments.length})\n\n`;
                for (const c of comments) {
                  output += `**${c.author?.login || "unknown"}** (${c.createdAt}):\n${c.body}\n\n---\n\n`;
                }
              }
            } catch { /* no comments */ }
          }

          return { content: [{ type: "text" as const, text: output }], details: { success: true, issue } };
        } catch (err: any) {
          return { content: [{ type: "text" as const, text: `Failed to get issue: ${err.message}` }], details: { success: false } };
        }
      },
    });

    api.registerTool({
      name: "oh_github_issue_comment",
      label: "Comment on GitHub Issue",

      parameters: Type.Object({
        number: Type.Number({ description: "Issue number" }),
        body: Type.String({ description: "Comment body (markdown)" }),
        repo: Type.Optional(Type.String({ description: "Repository (owner/repo)" })),
      }),
      async execute(_toolCallId: string, params: any) {
        const repo = params.repo || await detectRepo();
        if (!repo) {
          return { content: [{ type: "text" as const, text: "Could not detect GitHub repository." }], details: { success: false } };
        }

        try {
          const result = await runGh(["issue", "comment", String(params.number), "--repo", repo, "--body", `"${params.body.replace(/"/g, '\\"')}"`]);
          return { content: [{ type: "text" as const, text: `Comment added to #${params.number} in ${repo}` }], details: { success: true } };
        } catch (err: any) {
          return { content: [{ type: "text" as const, text: `Failed to add comment: ${err.message}` }], details: { success: false } };
        }
      },
    });

    api.registerTool({
      name: "oh_github_pr_comments",
      label: "PR Comments",

      parameters: Type.Object({
        action: Type.String({ description: "Action", enum: ["list", "add"] }),
        number: Type.Number({ description: "PR number" }),
        body: Type.Optional(Type.String({ description: "Comment body (for add action)" })),
        repo: Type.Optional(Type.String({ description: "Repository (owner/repo)" })),
      }),
      async execute(_toolCallId: string, params: any) {
        const repo = params.repo || await detectRepo();
        if (!repo) {
          return { content: [{ type: "text" as const, text: "Could not detect GitHub repository." }], details: { success: false } };
        }

        if (params.action === "list") {
          try {
            const json = await runGh(["pr", "view", String(params.number), "--repo", repo, "--comments", "--json", "comments"]);
            const comments = JSON.parse(json).comments || [];
            if (comments.length === 0) {
              return { content: [{ type: "text" as const, text: `No comments on PR #${params.number}` }], details: { success: true } };
            }
            let output = `## Comments on PR #${params.number}\n\n`;
            for (const c of comments) {
              output += `**${c.author?.login || "unknown"}** (${c.createdAt}):\n${c.body}\n\n---\n\n`;
            }
            return { content: [{ type: "text" as const, text: output }], details: { success: true, count: comments.length } };
          } catch (err: any) {
            return { content: [{ type: "text" as const, text: `Failed to list PR comments: ${err.message}` }], details: { success: false } };
          }
        } else if (params.action === "add") {
          if (!params.body) {
            return { content: [{ type: "text" as const, text: "Comment body required for add action." }], details: { success: false } };
          }
          try {
            await runGh(["pr", "comment", String(params.number), "--repo", repo, "--body", `"${params.body.replace(/"/g, '\\"')}"`]);
            return { content: [{ type: "text" as const, text: `Comment added to PR #${params.number}` }], details: { success: true } };
          } catch (err: any) {
            return { content: [{ type: "text" as const, text: `Failed to add PR comment: ${err.message}` }], details: { success: false } };
          }
        }

        return { content: [{ type: "text" as const, text: `Unknown action: ${params.action}` }], details: { success: false } };
      },
    });

    api.registerTool({
      name: "oh_github_pr_review",
      label: "Submit PR Review",

      parameters: Type.Object({
        number: Type.Number({ description: "PR number" }),
        action: Type.String({ description: "Review action", enum: ["approve", "request_changes", "comment"] }),
        body: Type.Optional(Type.String({ description: "Review comment body" })),
        repo: Type.Optional(Type.String({ description: "Repository (owner/repo)" })),
      }),
      async execute(_toolCallId: string, params: any) {
        const repo = params.repo || await detectRepo();
        if (!repo) {
          return { content: [{ type: "text" as const, text: "Could not detect GitHub repository." }], details: { success: false } };
        }

        try {
          const reviewFlag = params.action === "approve" ? "--approve" : params.action === "request_changes" ? "--request-changes" : "--comment";
          const args = ["pr", "review", String(params.number), "--repo", repo, reviewFlag];
          if (params.body) args.push("--body", `"${params.body.replace(/"/g, '\\"')}"`);
          await runGh(args);

          const actionLabel = params.action === "approve" ? "Approved" : params.action === "request_changes" ? "Changes Requested" : "Commented";
          return { content: [{ type: "text" as const, text: `PR #${params.number} ${actionLabel.toLowerCase()}` }], details: { success: true, action: params.action } };
        } catch (err: any) {
          return { content: [{ type: "text" as const, text: `Failed to submit PR review: ${err.message}` }], details: { success: false } };
        }
      },
    });
  }
