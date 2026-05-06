import type { PluginRuntime } from "openclaw/plugin-sdk/core";
import type { WorkflowContext, WorkflowStep, WorkflowMode } from "../types.js";
import { exec } from "child_process";
import { promisify } from "util";
import { existsSync, readFileSync, writeFileSync, mkdirSync, renameSync } from "fs";
import { join } from "path";

const execAsync = promisify(exec);

export interface HandoverDocument {
  generatedAt: string;
  generatedBy: string;
  projectName: string;
  projectDir: string;
  currentProgress: {
    step: WorkflowStep | string;
    currentTask: string;
    tasksCompleted: string;
    gitBranch: string;
    uncommittedChanges: string;
  };
  completedItems: string[];
  keyDecisions: Array<{ decision: string; choice: string; reason: string; impact: string }>;
  techContext: {
    languageFramework: string;
    mode: WorkflowMode;
    openSource: string;
    techStack: string;
    keyDependencies: string;
  };
  pendingItems: Array<{ title: string; description: string; currentState: string; nextAction: string }>;
  knownIssues: Array<{ issue: string; severity: "high" | "medium" | "low"; status: string; notes: string }>;
  specStatus: {
    proposal: { status: string; path: string };
    design: { status: string; path: string };
    tasks: { status: string; path: string };
  };
  directorySnapshot: string;
  recoveryStrategy: string[];
}

export class HandoverManager {
  private runtime: PluginRuntime;
  private readonly HANDOVER_FILE = "docs/handover.md";
  private readonly ARCHIVE_DIR = "docs/handover/archive";

  constructor(runtime: PluginRuntime) {
    this.runtime = runtime;
  }

  async generate(context: WorkflowContext, model: string): Promise<string> {
    const logger = this.runtime.logging.getChildLogger({ level: "info" });
    logger.info(`[HandoverManager] Generating handover document for ${context.projectId}`);

    const projectDir = context.projectDir;
    const docsDir = join(projectDir, "docs");
    if (!existsSync(docsDir)) mkdirSync(docsDir, { recursive: true });

    const gitStatus = await this.getGitStatus(projectDir);
    const specStatus = this.getSpecStatus(projectDir);
    const dirSnapshot = await this.getDirectorySnapshot(projectDir);

    const doc: HandoverDocument = {
      generatedAt: new Date().toISOString(),
      generatedBy: model,
      projectName: context.projectId,
      projectDir,
      currentProgress: {
        step: context.currentStep,
        currentTask: context.spec?.tasks.find((t) => t.status === "in_progress")?.id ?? context.spec?.tasks.find((t) => t.status === "pending")?.id ?? "N/A",
        tasksCompleted: `${context.spec?.tasks.filter((t) => t.status === "completed").length ?? 0}/${context.spec?.tasks.length ?? 0}`,
        gitBranch: context.branchName ?? "main",
        uncommittedChanges: gitStatus.dirty ? "Yes" : "No",
      },
      completedItems: context.spec
        ? context.spec.tasks.filter((t) => t.status === "completed").map((t) => `[x] ${t.id}: ${t.title}`)
        : [`[x] Step: ${context.currentStep}`],
      keyDecisions: context.decisions.map((d) => ({
        decision: d,
        choice: d,
        reason: "Auto-recorded",
        impact: "TBD",
      })),
      techContext: {
        languageFramework: this.detectTechStack(projectDir),
        mode: context.mode,
        openSource: context.openSource === true ? "Open Source" : context.openSource === false ? "Private" : "Unknown",
        techStack: this.detectTechStack(projectDir),
        keyDependencies: this.detectDependencies(projectDir),
      },
      pendingItems: context.spec
        ? context.spec.tasks.filter((t) => t.status === "pending" || t.status === "failed").map((t) => ({
            title: t.id,
            description: t.title,
            currentState: t.status,
            nextAction: `Execute task: ${t.description}`,
          }))
        : [{ title: "Continue workflow", description: `Resume from ${context.currentStep}`, currentState: context.currentStep, nextAction: "Run /dwf to resume" }],
      knownIssues: context.spec
        ? context.spec.tasks.filter((t) => t.status === "failed").map((t) => ({
            issue: `Task ${t.id} failed: ${t.title}`,
            severity: "medium" as const,
            status: "Pending fix",
            notes: t.description,
          }))
        : [],
      specStatus,
      directorySnapshot: dirSnapshot,
      recoveryStrategy: [
        "Run Step 0 scan to verify project state",
        "Read this handover document to restore context",
        `Resume from Step: ${context.currentStep}`,
        context.spec ? `Review openspec/changes/ for spec details` : "Generate spec before proceeding",
      ],
    };

    const content = this.formatHandover(doc);
    const filePath = join(projectDir, this.HANDOVER_FILE);
    writeFileSync(filePath, content);

    logger.info(`[HandoverManager] Handover document saved to ${filePath}`);
    return content;
  }

  async consume(projectDir: string): Promise<HandoverDocument | null> {
    const logger = this.runtime.logging.getChildLogger({ level: "info" });
    const filePath = join(projectDir, this.HANDOVER_FILE);

    if (!existsSync(filePath)) {
      logger.info("[HandoverManager] No handover document found");
      return null;
    }

    try {
      const content = readFileSync(filePath, "utf-8");
      const doc = this.parseHandover(content);

      if (doc) {
        this.archiveHandover(projectDir);
        logger.info(`[HandoverManager] Handover consumed and archived for ${doc.projectName}`);
      }

      return doc;
    } catch (e) {
      logger.warn(`[HandoverManager] Failed to parse handover: ${e}`);
      return null;
    }
  }

  private formatHandover(doc: HandoverDocument): string {
    const lines = [
      "# 会话交接文档",
      "",
      `> 生成时间：${doc.generatedAt}`,
      `> 生成模型：${doc.generatedBy}`,
      `> 项目名称：${doc.projectName}`,
      `> 项目目录：${doc.projectDir}`,
      "",
      "## 当前进度",
      "",
      "| 维度 | 状态 |",
      "|------|------|",
      `| 流程步骤 | ${doc.currentProgress.step} |`,
      `| 当前任务 | ${doc.currentProgress.currentTask} |`,
      `| 任务完成度 | ${doc.currentProgress.tasksCompleted} |`,
      `| Git 分支 | ${doc.currentProgress.gitBranch} |`,
      `| 未提交变更 | ${doc.currentProgress.uncommittedChanges} |`,
      "",
      "## 已完成事项",
      "",
      ...doc.completedItems.map((item) => `- ${item}`),
      "",
      "## 关键决策记录",
      "",
      "| 决策 | 选择 | 原因 | 影响范围 |",
      "|------|------|------|---------|",
      ...doc.keyDecisions.map((d) => `| ${d.decision} | ${d.choice} | ${d.reason} | ${d.impact} |`),
      "",
      "## 技术上下文",
      "",
      "| 项目 | 值 |",
      "|------|-----|",
      `| 语言/框架 | ${doc.techContext.languageFramework} |`,
      `| 项目类型 | ${doc.techContext.mode} |`,
      `| 开源/闭源 | ${doc.techContext.openSource} |`,
      `| 技术栈 | ${doc.techContext.techStack} |`,
      `| 关键依赖 | ${doc.techContext.keyDependencies} |`,
      "",
      "## 未完成事项（下一个 LLM 必读）",
      "",
      ...doc.pendingItems.map((item, i) => `${i + 1}. **${item.title}**：${item.description}\n   当前状态：${item.currentState}\n   下一步：${item.nextAction}`),
      "",
      "## 已知问题 / 阻塞项",
      "",
      "| 问题 | 严重度 | 状态 | 备注 |",
      "|------|--------|------|------|",
      ...doc.knownIssues.map((i) => `| ${i.issue} | ${i.severity} | ${i.status} | ${i.notes} |`),
      "",
      "## Spec 状态",
      "",
      "| 文件 | 状态 | 路径 |",
      "|------|------|------|",
      `| proposal.md | ${doc.specStatus.proposal.status} | ${doc.specStatus.proposal.path} |`,
      `| design.md | ${doc.specStatus.design.status} | ${doc.specStatus.design.path} |`,
      `| tasks.md | ${doc.specStatus.tasks.status} | ${doc.specStatus.tasks.path} |`,
      "",
      "## 目录结构快照",
      "",
      "```",
      doc.directorySnapshot,
      "```",
      "",
      "## 建议的恢复策略",
      "",
      "> 下一个 LLM 应该：",
      ...doc.recoveryStrategy.map((s, i) => `> ${i + 1}. ${s}`),
      "",
    ];

    return lines.join("\n");
  }

  private parseHandover(content: string): HandoverDocument | null {
    const getValue = (key: string): string => {
      const match = content.match(new RegExp(`> ${key}：(.+)`));
      return match ? match[1].trim() : "";
    };

    // ── Parse table rows: "| col1 | col2 | col3 | col4 |" ──
    const parseTableSection = (header: string, colCount: number): string[][] => {
      const sectionStart = content.indexOf(`## ${header}`);
      if (sectionStart === -1) return [];
      const sectionEnd = content.indexOf("\n## ", sectionStart + 1);
      const section = sectionEnd === -1
        ? content.slice(sectionStart)
        : content.slice(sectionStart, sectionEnd);

      return section
        .split("\n")
        .filter((line) => line.startsWith("|") && !line.includes("---"))
        .map((line) =>
          line.split("|").filter((c) => c.trim() !== "").map((c) => c.trim())
        )
        .filter((row) => row.length === colCount);
    };

    // ── Parse list items under a section ──
    const parseListSection = (header: string): string[] => {
      const sectionStart = content.indexOf(`## ${header}`);
      if (sectionStart === -1) return [];
      const sectionEnd = content.indexOf("\n## ", sectionStart + 1);
      const section = sectionEnd === -1
        ? content.slice(sectionStart)
        : content.slice(sectionStart, sectionEnd);

      return section
        .split("\n")
        .filter((line) => line.startsWith("- "))
        .map((line) => line.slice(2).trim());
    };

    // ── Parse numbered list items (pending items with bold title + details) ──
    const parsePendingItems = (): HandoverDocument["pendingItems"] => {
      const sectionStart = content.indexOf("## 未完成事项");
      if (sectionStart === -1) return [];
      const sectionEnd = content.indexOf("\n## ", sectionStart + 1);
      const section = sectionEnd === -1
        ? content.slice(sectionStart)
        : content.slice(sectionStart, sectionEnd);

      const items: HandoverDocument["pendingItems"] = [];
      const blocks = section.split(/\n(?=\d+\.\s\*\*)/);
      for (const block of blocks.slice(1)) { // skip first chunk (header text)
        const titleMatch = block.match(/\d+\.\s\*\*(.+?)\*\*[：:]\s*(.+)/);
        if (!titleMatch) continue;
        const stateMatch = block.match(/当前状态[：:]\s*(.+)/);
        const actionMatch = block.match(/下一步[：:]\s*(.+)/);
        items.push({
          title: titleMatch[1].trim(),
          description: titleMatch[2].trim(),
          currentState: stateMatch?.[1].trim() ?? "unknown",
          nextAction: actionMatch?.[1].trim() ?? "N/A",
        });
      }
      return items;
    };

    // ── Parse current progress table ──
    const progressRows = parseTableSection("当前进度", 2);
    const getProgressValue = (dimension: string): string => {
      const row = progressRows.find((r) => r[0].includes(dimension));
      return row ? row[1] : "";
    };

    // ── Parse tech context table ──
    const techRows = parseTableSection("技术上下文", 2);
    const getTechValue = (item: string): string => {
      const row = techRows.find((r) => r[0].includes(item));
      return row ? row[1] : "";
    };

    // ── Parse spec status table ──
    const specRows = parseTableSection("Spec 状态", 3);
    const getSpecEntry = (file: string): { status: string; path: string } => {
      const row = specRows.find((r) => r[0].includes(file));
      return { status: row?.[1] ?? "unknown", path: row?.[2] ?? "N/A" };
    };

    // ── Parse key decisions table ──
    const decisionRows = parseTableSection("关键决策记录", 4);
    const keyDecisions = decisionRows.map((r) => ({
      decision: r[0],
      choice: r[1],
      reason: r[2],
      impact: r[3],
    }));

    // ── Parse known issues table ──
    const issueRows = parseTableSection("已知问题", 4);
    const knownIssues = issueRows.map((r) => ({
      issue: r[0],
      severity: (["high", "medium", "low"].includes(r[1]) ? r[1] : "medium") as "high" | "medium" | "low",
      status: r[2],
      notes: r[3],
    }));

    // ── Parse directory snapshot (code block) ──
    const dirMatch = content.match(/## 目录结构快照\n\n```\n([\s\S]*?)```/);
    const directorySnapshot = dirMatch?.[1]?.trim() ?? "";

    // ── Parse recovery strategy (quoted lines) ──
    const recoveryStart = content.indexOf("## 建议的恢复策略");
    let recoveryStrategy: string[] = [];
    if (recoveryStart !== -1) {
      const recoveryEnd = content.indexOf("\n## ", recoveryStart + 1);
      const recoverySection = recoveryEnd === -1
        ? content.slice(recoveryStart)
        : content.slice(recoveryStart, recoveryEnd);
      recoveryStrategy = recoverySection
        .split("\n")
        .filter((line) => line.startsWith("> ") && !line.includes("下一个 LLM"))
        .map((line) => line.replace(/^>\s*\d*\.\s*/, "").trim());
    }

    // ── Parse completed items ──
    const completedItems = parseListSection("已完成事项");

    return {
      generatedAt: getValue("生成时间"),
      generatedBy: getValue("生成模型"),
      projectName: getValue("项目名称"),
      projectDir: getValue("项目目录"),
      currentProgress: {
        step: getProgressValue("流程步骤") || "unknown",
        currentTask: getProgressValue("当前任务") || "N/A",
        tasksCompleted: getProgressValue("任务完成度") || "0/0",
        gitBranch: getProgressValue("Git 分支") || "main",
        uncommittedChanges: getProgressValue("未提交变更") || "No",
      },
      completedItems,
      keyDecisions,
      techContext: {
        languageFramework: getTechValue("语言/框架"),
        mode: (["quick", "standard", "full", "ultra"].includes(getTechValue("项目类型"))
          ? getTechValue("项目类型") : "standard") as WorkflowMode,
        openSource: getTechValue("开源/闭源"),
        techStack: getTechValue("技术栈"),
        keyDependencies: getTechValue("关键依赖"),
      },
      pendingItems: parsePendingItems(),
      knownIssues,
      specStatus: {
        proposal: getSpecEntry("proposal"),
        design: getSpecEntry("design"),
        tasks: getSpecEntry("tasks"),
      },
      directorySnapshot,
      recoveryStrategy,
    };
  }

  private archiveHandover(projectDir: string): void {
    const sourcePath = join(projectDir, this.HANDOVER_FILE);
    if (!existsSync(sourcePath)) return;

    const archiveDir = join(projectDir, this.ARCHIVE_DIR);
    if (!existsSync(archiveDir)) mkdirSync(archiveDir, { recursive: true });

    const date = new Date().toISOString().split("T")[0];
    const archivePath = join(archiveDir, `${date}--handover.md`);

    let finalPath = archivePath;
    let counter = 1;
    while (existsSync(finalPath)) {
      finalPath = join(archiveDir, `${date}--handover-${counter}.md`);
      counter++;
    }

    try {
      renameSync(sourcePath, finalPath);
    } catch { /* skip */ }
  }

  private async getGitStatus(projectDir: string): Promise<{ dirty: boolean; branch: string }> {
    try {
      const { stdout: statusOut } = await execAsync("git status --porcelain", { cwd: projectDir, timeout: 5000 });
      const { stdout: branchOut } = await execAsync("git branch --show-current", { cwd: projectDir, timeout: 5000 });
      return { dirty: statusOut.trim().length > 0, branch: branchOut.trim() || "main" };
    } catch {
      return { dirty: false, branch: "main" };
    }
  }

  private getSpecStatus(projectDir: string): HandoverDocument["specStatus"] {
    const changesDir = join(projectDir, "openspec", "changes");
    const checkFile = (name: string): { status: string; path: string } => {
      const dirs = existsSync(changesDir) ? this.findSpecFiles(changesDir) : [];
      for (const dir of dirs) {
        const fp = join(changesDir, dir, name);
        if (existsSync(fp)) return { status: "已创建", path: `openspec/changes/${dir}/${name}` };
      }
      return { status: "未创建", path: `openspec/changes/<change>/${name}` };
    };

    return {
      proposal: checkFile("proposal.md"),
      design: checkFile("design.md"),
      tasks: checkFile("tasks.md"),
    };
  }

  private findSpecFiles(changesDir: string): string[] {
    try {
      return readFileSync(join(changesDir), "utf-8").split("\n").filter(Boolean);
    } catch {
      try {
        const { execSync } = require("child_process");
        return execSync(`ls "${changesDir}"`, { encoding: "utf-8" }).trim().split("\n").filter(Boolean);
      } catch {
        return [];
      }
    }
  }

  private async getDirectorySnapshot(projectDir: string): Promise<string> {
    try {
      const { stdout } = await execAsync("find . -maxdepth 3 -type d -not -path '*/node_modules/*' -not -path '*/.git/*' -not -path '*/dist/*' | head -50", {
        cwd: projectDir,
        timeout: 10000,
      });
      return stdout.trim();
    } catch {
      return "(Directory snapshot unavailable)";
    }
  }

  private detectTechStack(projectDir: string): string {
    const parts: string[] = [];
    if (existsSync(join(projectDir, "package.json"))) parts.push("Node.js/TypeScript");
    if (existsSync(join(projectDir, "requirements.txt")) || existsSync(join(projectDir, "pyproject.toml"))) parts.push("Python");
    if (existsSync(join(projectDir, "Cargo.toml"))) parts.push("Rust");
    if (existsSync(join(projectDir, "go.mod"))) parts.push("Go");
    if (existsSync(join(projectDir, "tsconfig.json"))) parts.push("TypeScript");
    if (existsSync(join(projectDir, "Dockerfile"))) parts.push("Docker");
    return parts.length > 0 ? parts.join(", ") : "Unknown";
  }

  private detectDependencies(projectDir: string): string {
    const pkgPath = join(projectDir, "package.json");
    if (existsSync(pkgPath)) {
      try {
        const pkg = JSON.parse(readFileSync(pkgPath, "utf-8"));
        const deps = Object.keys(pkg.dependencies || {});
        const devDeps = Object.keys(pkg.devDependencies || {});
        return [...deps, ...devDeps].slice(0, 10).join(", ") || "None";
      } catch { /* skip */ }
    }

    const reqPath = join(projectDir, "requirements.txt");
    if (existsSync(reqPath)) {
      try {
        const content = readFileSync(reqPath, "utf-8");
        return content.split("\n").filter((l) => l.trim() && !l.startsWith("#")).slice(0, 10).join(", ");
      } catch { /* skip */ }
    }

    return "Unknown";
  }
}
