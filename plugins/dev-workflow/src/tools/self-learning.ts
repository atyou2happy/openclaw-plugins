/**
 * Self-Learning Engine — v24 Pillar 2 module
 *
 * Captures development experience and feeds it back into workflow decisions.
 * Principles #106-109: experience capture, pattern extraction,
 * adaptive thresholds, cross-project knowledge transfer.
 *
 * Inspired by: Ruflo meta-learning + CrewAI memory + Autoskill pattern
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { join } from "path";

// ── Types ──

export type ExperienceCategory = "success" | "failure" | "near_miss";

export interface Experience {
  id: string;
  category: ExperienceCategory;
  step: string;           // workflow step (step1..step12)
  context: string;        // what was being done
  action: string;         // what was tried
  outcome: string;        // what happened
  lesson: string;         // what was learned
  tags: string[];
  projectHash: string;    // to enable cross-project learning
  timestamp: string;
}

export interface Pattern {
  id: string;
  name: string;
  description: string;
  triggerConditions: string[];
  recommendedAction: string;
  confidence: number;     // 0-1, increases with repetitions
  occurrences: number;
  lastSeen: string;
}

export interface AdaptiveThreshold {
  name: string;
  defaultValue: number;
  currentValue: number;
  adjustments: ThresholdAdjustment[];
}

export interface ThresholdAdjustment {
  timestamp: string;
  from: number;
  to: number;
  reason: string;
}

export interface LearningExport {
  totalExperiences: number;
  totalPatterns: number;
  categoryBreakdown: Record<ExperienceCategory, number>;
  topPatterns: Pattern[];
  thresholds: AdaptiveThreshold[];
}

// ── SelfLearningEngine ──

export class SelfLearningEngine {
  private dataDir: string;
  private experiences: Experience[] = [];
  private patterns: Pattern[] = [];
  private thresholds: Map<string, AdaptiveThreshold> = new Map();

  constructor(projectDir: string) {
    this.dataDir = join(projectDir, ".dev-workflow", "learning");
  }

  // ── Initialize ──

  init(): void {
    if (!existsSync(this.dataDir)) {
      mkdirSync(this.dataDir, { recursive: true });
    }
    this.loadExperiences();
    this.loadPatterns();
    this.loadThresholds();
  }

  // ── Experience Capture (Principle #106) ──

  /** Record a development experience */
  recordExperience(
    category: ExperienceCategory,
    step: string,
    context: string,
    action: string,
    outcome: string,
    lesson: string,
    tags: string[] = [],
    projectHash: string = "default",
  ): Experience {
    const exp: Experience = {
      id: `exp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      category,
      step,
      context,
      action,
      outcome,
      lesson,
      tags,
      projectHash,
      timestamp: new Date().toISOString(),
    };
    this.experiences.push(exp);
    this.persistExperiences();

    // Auto-extract pattern if similar experiences exist
    this.tryExtractPattern(exp);

    return exp;
  }

  /** Record from a completed task (auto-categorize) */
  recordFromTask(
    step: string,
    taskDescription: string,
    success: boolean,
    errorOutput: string | undefined,
    projectHash: string = "default",
  ): Experience {
    return this.recordExperience(
      success ? "success" : "failure",
      step,
      taskDescription,
      success ? "completed" : "failed",
      success ? "Task passed" : (errorOutput || "Unknown error"),
      success ? "" : this.inferLesson(errorOutput || ""),
      success ? ["auto", "pass"] : ["auto", "fail"],
      projectHash,
    );
  }

  // ── Pattern Extraction (Principle #107) ──

  /** Try to extract or reinforce a pattern from a new experience */
  private tryExtractPattern(exp: Experience): void {
    // Find similar past experiences (same step + overlapping tags)
    const similar = this.experiences.filter(e =>
      e.id !== exp.id &&
      e.step === exp.step &&
      e.category === exp.category &&
      this.tagOverlap(e.tags, exp.tags) >= 1,
    );

    if (similar.length < 2) return; // Need 3+ total for a pattern

    // Check if pattern already exists for this step+category
    const existingPattern = this.patterns.find(p =>
      p.triggerConditions.some(c => c === `step:${exp.step}`) &&
      p.triggerConditions.some(c => c === `category:${exp.category}`),
    );

    if (existingPattern) {
      // Reinforce
      existingPattern.occurrences++;
      existingPattern.confidence = Math.min(1, existingPattern.confidence + 0.05);
      existingPattern.lastSeen = exp.timestamp;
      if (exp.lesson) existingPattern.recommendedAction = exp.lesson;
    } else {
      // Create new pattern
      const pattern: Pattern = {
        id: `pat-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        name: `${exp.step} ${exp.category} pattern`,
        description: `Repeated ${exp.category} in ${exp.step}: ${exp.outcome.slice(0, 100)}`,
        triggerConditions: [`step:${exp.step}`, `category:${exp.category}`, ...exp.tags.map(t => `tag:${t}`)],
        recommendedAction: exp.lesson || `Review approach for ${exp.step}`,
        confidence: 0.3,
        occurrences: similar.length + 1,
        lastSeen: exp.timestamp,
      };
      this.patterns.push(pattern);
    }

    this.persistPatterns();
  }

  // ── Adaptive Thresholds (Principle #108) ──

  /** Register an adaptive threshold */
  registerThreshold(name: string, defaultValue: number): void {
    if (!this.thresholds.has(name)) {
      this.thresholds.set(name, {
        name,
        defaultValue,
        currentValue: defaultValue,
        adjustments: [],
      });
    }
  }

  /** Get current threshold value */
  getThreshold(name: string): number {
    return this.thresholds.get(name)?.currentValue ?? 0;
  }

  /** Adjust a threshold based on failure rate */
  adjustThreshold(name: string, recentSuccessRate: number, reason: string): number {
    const t = this.thresholds.get(name);
    if (!t) return 0;

    const prev = t.currentValue;
    // If success rate is low → relax threshold (increase for max-like, decrease for min-like)
    // Simple: adjust by ±10% based on success rate
    const direction = recentSuccessRate < 0.5 ? 1 : -1;
    const delta = t.defaultValue * 0.1 * direction;
    const newVal = Math.max(t.defaultValue * 0.5, Math.min(t.defaultValue * 2, prev + delta));

    if (Math.abs(newVal - prev) > 0.001) {
      t.adjustments.push({
        timestamp: new Date().toISOString(),
        from: prev,
        to: newVal,
        reason,
      });
      t.currentValue = newVal;
      this.persistThresholds();
    }

    return newVal;
  }

  // ── Cross-Project Knowledge (Principle #109) ──

  /** Get patterns applicable to a given step */
  getApplicablePatterns(step: string, tags: string[] = []): Pattern[] {
    return this.patterns
      .filter(p => {
        const stepMatch = p.triggerConditions.some(c => c === `step:${step}`);
        const tagMatch = tags.length === 0 || tags.some(t => p.triggerConditions.includes(`tag:${t}`));
        return stepMatch && tagMatch;
      })
      .sort((a, b) => b.confidence - a.confidence);
  }

  /** Get recommended action for a step */
  getRecommendation(step: string, tags: string[] = []): string | null {
    const patterns = this.getApplicablePatterns(step, tags);
    if (patterns.length === 0 || patterns[0].confidence < 0.4) return null;
    return patterns[0].recommendedAction;
  }

  // ── Query ──

  /** Get all experiences */
  getExperiences(category?: ExperienceCategory): Experience[] {
    if (category) return this.experiences.filter(e => e.category === category);
    return [...this.experiences];
  }

  /** Get all patterns */
  getPatterns(): Pattern[] {
    return [...this.patterns];
  }

  /** Get all thresholds */
  getThresholds(): AdaptiveThreshold[] {
    return [...this.thresholds.values()];
  }

  /** Export for Retro analysis */
  export(): LearningExport {
    const breakdown: Record<ExperienceCategory, number> = { success: 0, failure: 0, near_miss: 0 };
    for (const e of this.experiences) breakdown[e.category]++;

    return {
      totalExperiences: this.experiences.length,
      totalPatterns: this.patterns.length,
      categoryBreakdown: breakdown,
      topPatterns: this.patterns.sort((a, b) => b.confidence - a.confidence).slice(0, 10),
      thresholds: [...this.thresholds.values()],
    };
  }

  // ── Persistence ──

  private persistExperiences(): void {
    const path = join(this.dataDir, "experiences.json");
    writeFileSync(path, JSON.stringify(this.experiences, null, 2), "utf-8");
  }

  private loadExperiences(): void {
    const path = join(this.dataDir, "experiences.json");
    if (!existsSync(path)) return;
    try {
      this.experiences = JSON.parse(readFileSync(path, "utf-8"));
    } catch { this.experiences = []; }
  }

  private persistPatterns(): void {
    const path = join(this.dataDir, "patterns.json");
    writeFileSync(path, JSON.stringify(this.patterns, null, 2), "utf-8");
  }

  private loadPatterns(): void {
    const path = join(this.dataDir, "patterns.json");
    if (!existsSync(path)) return;
    try {
      this.patterns = JSON.parse(readFileSync(path, "utf-8"));
    } catch { this.patterns = []; }
  }

  private persistThresholds(): void {
    const path = join(this.dataDir, "thresholds.json");
    const data = [...this.thresholds.entries()].map(([k, v]) => v);
    writeFileSync(path, JSON.stringify(data, null, 2), "utf-8");
  }

  private loadThresholds(): void {
    const path = join(this.dataDir, "thresholds.json");
    if (!existsSync(path)) return;
    try {
      const data: AdaptiveThreshold[] = JSON.parse(readFileSync(path, "utf-8"));
      for (const t of data) this.thresholds.set(t.name, t);
    } catch { /* empty */ }
  }

  // ── Helpers ──

  private tagOverlap(a: string[], b: string[]): number {
    return a.filter(t => b.includes(t)).length;
  }

  private inferLesson(errorOutput: string): string {
    // Simple heuristic inference from error messages
    const lower = errorOutput.toLowerCase();
    if (lower.includes("timeout")) return "Consider increasing timeout or reducing task scope";
    if (lower.includes("typeerror") || lower.includes("type error")) return "Add type checks or refine interface definitions";
    if (lower.includes("not found") || lower.includes("enoent")) return "Verify file paths exist before access";
    if (lower.includes("permission") || lower.includes("eacces")) return "Check file/directory permissions";
    if (lower.includes("syntax")) return "Validate syntax before execution";
    return "Review error context and add preventive checks";
  }
}
