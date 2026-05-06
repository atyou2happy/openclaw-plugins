import type { PluginRuntime } from "openclaw/plugin-sdk/core";
import { existsSync, readFileSync, writeFileSync, mkdirSync, readdirSync, unlinkSync } from "fs";
import { join } from "path";

export interface WorkingMemoryProjectLayer {
  filePath: string;
  content: string;
  lastModified: string;
  sizeTokens: number;
}

export interface WorkingMemoryTaskLayer {
  taskId: string;
  filePath: string;
  content: string;
  decisions: string[];
  completedItems: string[];
  currentState: string;
  pendingItems: string[];
  updatedAt: string;
}

export interface WorkingMemoryStepLayer {
  activeFiles: string[];
  recentCommands: string[];
  tempVariables: Map<string, string>;
  failedAttempts: string[];
}

export interface CompactSummary {
  iteration: number;
  preservedFromPrevious: {
    keyDecisions: string[];
    constraints: string[];
    completedItems: string[];
  };
  newAdditions: {
    currentState: string;
    workingOn: string;
    pendingItems: string[];
  };
  fileTracking: string[];
  timestamp: string;
}

export interface AutoCompactConfig {
  l1MaxToolOutputs: number;
  l1MaxChars: number;
  l2MaxToolOutputs: number;
  l2MaxChars: number;
  projectLayerMaxTokens: number;
  taskLayerMaxTokens: number;
}

const DEFAULT_COMPACT_CONFIG: AutoCompactConfig = {
  l1MaxToolOutputs: 20,
  l1MaxChars: 40_000,
  l2MaxToolOutputs: 50,
  l2MaxChars: 100_000,
  projectLayerMaxTokens: 2000,
  taskLayerMaxTokens: 3000,
};

const PROJECT_LAYER_FILE = ".dev-workflow.md";
const TASK_CONTEXT_DIR = "docs/plans";

export class WorkingMemoryManager {
  private runtime: PluginRuntime;
  private config: AutoCompactConfig;
  private stepLayer: WorkingMemoryStepLayer;
  private compactHistory: CompactSummary[] = [];

  constructor(runtime: PluginRuntime, config?: Partial<AutoCompactConfig>) {
    this.runtime = runtime;
    this.config = { ...DEFAULT_COMPACT_CONFIG, ...config };
    this.stepLayer = {
      activeFiles: [],
      recentCommands: [],
      tempVariables: new Map(),
      failedAttempts: [],
    };
    this.compactHistory = [];
  }

  async initialize(projectDir: string): Promise<void> {
    const plansDir = join(projectDir, TASK_CONTEXT_DIR);
    if (!existsSync(plansDir)) {
      mkdirSync(plansDir, { recursive: true });
    }
  }

  async loadProjectLayer(projectDir: string): Promise<WorkingMemoryProjectLayer | null> {
    const filePath = join(projectDir, PROJECT_LAYER_FILE);
    if (!existsSync(filePath)) return null;
    try {
      const content = readFileSync(filePath, "utf-8");
      return {
        filePath,
        content,
        lastModified: new Date().toISOString(),
        sizeTokens: this.estimateTokens(content),
      };
    } catch {
      return null;
    }
  }

  async updateProjectLayer(projectDir: string, section: string, content: string): Promise<void> {
    const filePath = join(projectDir, PROJECT_LAYER_FILE);
    const existing = existsSync(filePath) ? readFileSync(filePath, "utf-8") : "";
    const marker = `## ${section}`;
    const markerIndex = existing.indexOf(marker);
    let updated: string;
    if (markerIndex !== -1) {
      const before = existing.substring(0, markerIndex);
      const afterMarker = existing.indexOf("\n## ", markerIndex + 1);
      const after = afterMarker !== -1 ? existing.substring(afterMarker) : "";
      updated = `${before}${marker}\n${content}\n${after}`;
    } else {
      updated = `${existing}\n${marker}\n${content}\n`;
    }
    writeFileSync(filePath, updated);
  }

  async loadTaskLayer(projectDir: string, taskId: string): Promise<WorkingMemoryTaskLayer | null> {
    const filePath = join(projectDir, TASK_CONTEXT_DIR, `${taskId}-context.md`);
    if (!existsSync(filePath)) return null;
    try {
      const content = readFileSync(filePath, "utf-8");
      const decisions = this.extractSection(content, "关键决策");
      const completedItems = this.extractSection(content, "已完成");
      const pendingItems = this.extractSection(content, "待处理");
      return {
        taskId,
        filePath,
        content,
        decisions,
        completedItems,
        currentState: this.extractSection(content, "当前状态")[0] ?? "",
        pendingItems,
        updatedAt: new Date().toISOString(),
      };
    } catch {
      return null;
    }
  }

  async saveTaskLayer(projectDir: string, taskId: string, layer: Partial<WorkingMemoryTaskLayer>): Promise<void> {
    const plansDir = join(projectDir, TASK_CONTEXT_DIR);
    if (!existsSync(plansDir)) mkdirSync(plansDir, { recursive: true });
    const filePath = join(plansDir, `${taskId}-context.md`);
    const existing = existsSync(filePath) ? readFileSync(filePath, "utf-8") : "";
    const sections: string[] = [];
    if (layer.decisions) sections.push(`## 关键决策\n${layer.decisions.join("\n")}`);
    if (layer.completedItems) sections.push(`## 已完成\n${layer.completedItems.map((i) => `- [x] ${i}`).join("\n")}`);
    if (layer.currentState) sections.push(`## 当前状态\n${layer.currentState}`);
    if (layer.pendingItems) sections.push(`## 待处理\n${layer.pendingItems.map((i) => `- [ ] ${i}`).join("\n")}`);
    const header = `# ${taskId} — 上下文`;
    const content = `${header}\n\n${sections.join("\n\n")}\n\nUpdated: ${new Date().toISOString()}\n`;
    writeFileSync(filePath, existing ? `${existing}\n---\n${content}` : content);
  }

  getStepLayer(): WorkingMemoryStepLayer {
    return { ...this.stepLayer };
  }

  updateStepLayerActiveFile(filePath: string): void {
    if (!this.stepLayer.activeFiles.includes(filePath)) {
      this.stepLayer.activeFiles = [filePath, ...this.stepLayer.activeFiles.slice(0, 2)];
    }
  }

  updateStepLayerCommand(output: string): void {
    this.stepLayer.recentCommands = [output.slice(0, 200), ...this.stepLayer.recentCommands.slice(0, 4)];
  }

  addFailedAttempt(description: string): void {
    this.stepLayer.failedAttempts = [description, ...this.stepLayer.failedAttempts.slice(0, 4)];
  }

  shouldCompact(): { needed: boolean; level: "l1" | "l2" | "none" } {
    const totalEntries = this.stepLayer.recentCommands.length +
      this.stepLayer.activeFiles.length +
      this.stepLayer.failedAttempts.length;
    const totalChars = this.stepLayer.recentCommands.join("").length +
      Array.from(this.stepLayer.tempVariables.values()).join("").length;

    if (totalEntries >= this.config.l2MaxToolOutputs || totalChars >= this.config.l2MaxChars) {
      return { needed: true, level: "l2" };
    }
    if (totalEntries >= this.config.l1MaxToolOutputs || totalChars >= this.config.l1MaxChars) {
      return { needed: true, level: "l1" };
    }
    return { needed: false, level: "none" };
  }

  async executeL1Compact(): Promise<void> {
    const logger = this.runtime.logging.getChildLogger({ level: "info" });
    logger.info("[WorkingMemory] L1 Microcompact: clearing step layer outputs");
    const preservedDecisions = this.stepLayer.recentCommands.slice(0, 3);
    this.stepLayer = {
      activeFiles: this.stepLayer.activeFiles.slice(0, 3),
      recentCommands: preservedDecisions,
      tempVariables: new Map(),
      failedAttempts: this.stepLayer.failedAttempts.slice(0, 2),
    };
  }

  async executeL2Compact(projectDir: string, taskId: string): Promise<CompactSummary> {
    const logger = this.runtime.logging.getChildLogger({ level: "info" });
    logger.info("[WorkingMemory] L2 Full Compact: compressing to task layer");
    const iteration = this.compactHistory.length + 1;
    const existingTaskLayer = await this.loadTaskLayer(projectDir, taskId);
    const summary: CompactSummary = {
      iteration,
      preservedFromPrevious: {
        keyDecisions: existingTaskLayer?.decisions ?? [],
        constraints: [],
        completedItems: existingTaskLayer?.completedItems ?? [],
      },
      newAdditions: {
        currentState: this.stepLayer.recentCommands[0] ?? "No current state",
        workingOn: this.stepLayer.activeFiles.join(", "),
        pendingItems: this.stepLayer.failedAttempts,
      },
      fileTracking: this.stepLayer.activeFiles.slice(0, 3),
      timestamp: new Date().toISOString(),
    };
    await this.saveTaskLayer(projectDir, taskId, {
      decisions: [...(existingTaskLayer?.decisions ?? []), ...summary.preservedFromPrevious.keyDecisions],
      completedItems: [...(existingTaskLayer?.completedItems ?? []), ...summary.newAdditions.currentState],
      currentState: summary.newAdditions.workingOn,
      pendingItems: summary.newAdditions.pendingItems,
    });
    this.compactHistory.push(summary);
    this.stepLayer = {
      activeFiles: [],
      recentCommands: [],
      tempVariables: new Map(),
      failedAttempts: [],
    };
    return summary;
  }

  async executeRecompaction(projectDir: string, taskId: string): Promise<CompactSummary> {
    const logger = this.runtime.logging.getChildLogger({ level: "info" });
    const previousSummary = this.compactHistory[this.compactHistory.length - 1];
    if (!previousSummary) {
      logger.warn("[WorkingMemory] No previous compact to re-compact");
      return this.executeL2Compact(projectDir, taskId);
    }
    logger.info("[WorkingMemory] Re-compaction: merging with previous summary");
    const merged: CompactSummary = {
      iteration: previousSummary.iteration + 1,
      preservedFromPrevious: {
        keyDecisions: [...previousSummary.preservedFromPrevious.keyDecisions, ...this.stepLayer.recentCommands.slice(0, 2)],
        constraints: previousSummary.preservedFromPrevious.constraints,
        completedItems: [...previousSummary.preservedFromPrevious.completedItems, ...(this.stepLayer.activeFiles.length > 0 ? [`Active: ${this.stepLayer.activeFiles.join(", ")}`] : [])],
      },
      newAdditions: {
        currentState: this.stepLayer.recentCommands[0] ?? previousSummary.newAdditions.currentState,
        workingOn: this.stepLayer.activeFiles.join(", ") || previousSummary.newAdditions.workingOn,
        pendingItems: [...previousSummary.newAdditions.pendingItems, ...this.stepLayer.failedAttempts],
      },
      fileTracking: this.stepLayer.activeFiles.slice(0, 3),
      timestamp: new Date().toISOString(),
    };
    await this.saveTaskLayer(projectDir, taskId, {
      decisions: merged.preservedFromPrevious.keyDecisions,
      completedItems: merged.preservedFromPrevious.completedItems,
      currentState: merged.newAdditions.workingOn,
      pendingItems: merged.newAdditions.pendingItems,
    });
    this.compactHistory.push(merged);
    this.stepLayer = {
      activeFiles: [],
      recentCommands: [],
      tempVariables: new Map(),
      failedAttempts: [],
    };
    return merged;
  }

  async compactTaskToSummary(projectDir: string, taskId: string): Promise<void> {
    const taskLayer = await this.loadTaskLayer(projectDir, taskId);
    if (!taskLayer) return;
    const summary = `Task ${taskId} completed. Key decisions: ${taskLayer.decisions.join("; ")}. Status: done.`;
    const projectLayer = await this.loadProjectLayer(projectDir);
    if (projectLayer) {
      await this.updateProjectLayer(projectDir, `Task Summary: ${taskId}`, summary);
    }
    const taskFile = join(projectDir, TASK_CONTEXT_DIR, `${taskId}-context.md`);
    if (existsSync(taskFile)) {
      const archiveDir = join(projectDir, TASK_CONTEXT_DIR, "archive");
      if (!existsSync(archiveDir)) mkdirSync(archiveDir, { recursive: true });
      try {
        const archiveContent = readFileSync(taskFile, "utf-8");
        writeFileSync(join(archiveDir, `${taskId}-context.md`), archiveContent);
        unlinkSync(taskFile);
      } catch { /* skip */ }
    }
  }

  private estimateTokens(content: string): number {
    // Count CJK characters (each ~1 token) separately from non-CJK (~4 chars/token).
    // A naive length/4 overestimates Chinese/Japanese/Korean text by ~4x.
    const cjkCount = (content.match(/[\u4e00-\u9fff\u3400-\u4dbf\u3000-\u303f]/g) || []).length;
    return Math.ceil(cjkCount * 1 + (content.length - cjkCount) / 4);
  }

  private extractSection(content: string, sectionHeader: string): string[] {
    const lines = content.split("\n");
    const results: string[] = [];
    let inSection = false;
    for (const line of lines) {
      if (line.startsWith(`## ${sectionHeader}`)) {
        inSection = true;
        continue;
      }
      if (inSection && line.startsWith("## ")) {
        inSection = false;
        continue;
      }
      if (inSection && line.trim()) {
        results.push(line.replace(/^[-*]\s*/, "").trim());
      }
    }
    return results;
  }
}
