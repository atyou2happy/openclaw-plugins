/**
 * SpecCompressor — Reduces spec token consumption without losing actionable information.
 *
 * Inspired by:
 * - Schema-driven specs (JSON Schema, OpenAPI spec style) vs natural language
 * - Aider's token-budgeted approach (cap → compress → truncate)
 * - OpenHands' structured observation format
 *
 * Strategy:
 * 1. Compress proposal: extract key points, remove filler, cap 200 words
 * 2. Compress design: schema-driven structure, remove redundancy
 * 3. Compress tasks: structured JSON with minimal descriptions
 * 4. Delta compression: only send changed parts of spec between steps
 *
 * Token savings: 40-60% spec tokens.
 */

import type { WorkflowSpec, WorkflowTask } from "../types.js";

// ─── Types ───

export interface CompressedSpec {
  /** Compressed proposal — key points only */
  proposal: string;
  /** Compressed design — structured sections */
  design: CompressedDesign;
  /** Compressed tasks — minimal viable info */
  tasks: CompressedTask[];
  /** Metadata */
  compressionRatio: number;
  originalTokens: number;
  compressedTokens: number;
}

export interface CompressedDesign {
  architecture: string;       // Max 100 chars
  patterns: string[];         // Max 5 items, max 30 chars each
  constraints: string[];      // Max 5 items, max 50 chars each
  interfaces: string[];       // Max 10 items, "name: signature" format
  dataFlow: string;           // Max 200 chars
}

export interface CompressedTask {
  id: string;
  title: string;              // Max 60 chars
  desc: string;               // Max 80 chars — compressed description
  diff: "easy" | "medium" | "hard";
  deps: string[];             // Dependency IDs only
  files: string[];            // File paths only
}

// ─── Token estimation ───

function estimateTokens(text: string): number {
  let tokens = 0;
  for (const ch of text) {
    const cp = ch.codePointAt(0)!;
    tokens += (cp >= 0x4E00 && cp <= 0x9FFF) ||
              (cp >= 0x3040 && cp <= 0x30FF) ||
              (cp >= 0xAC00 && cp <= 0xD7AF) ? 1 : 0.25;
  }
  return Math.ceil(tokens);
}

// ─── Compression Functions ───

function compressProposal(proposal: string): string {
  // Extract headings and first sentence after each heading
  const lines = proposal.split("\n");
  const compressed: string[] = [];
  let inCodeBlock = false;

  for (const line of lines) {
    if (line.startsWith("```")) {
      inCodeBlock = !inCodeBlock;
      continue;
    }
    if (inCodeBlock) continue; // Skip code blocks in compressed view

    // Keep headings
    if (line.startsWith("#")) {
      compressed.push(line.replace(/#+\s*/, "").trim());
      continue;
    }

    // Keep bullet points (but only first 15 words)
    if (line.match(/^[-*]\s/)) {
      const words = line.trim().split(/\s+/);
      compressed.push(words.length > 15
        ? words.slice(0, 15).join(" ") + "..."
        : line.trim()
      );
      continue;
    }

    // Keep first sentence of paragraphs
    const sentenceMatch = line.match(/^[^.!?]+[.!?]/);
    if (sentenceMatch && line.trim().length > 20) {
      const sentence = sentenceMatch[0];
      compressed.push(sentence.length > 100 ? sentence.slice(0, 100) + "..." : sentence);
    }
  }

  return compressed.join("\n");
}

function compressDesign(design: string): CompressedDesign {
  const result: CompressedDesign = {
    architecture: "",
    patterns: [],
    constraints: [],
    interfaces: [],
    dataFlow: "",
  };

  const sections = design.split(/(?=^#{1,3}\s)/m);

  for (const section of sections) {
    const heading = section.split("\n")[0]?.replace(/#+\s*/, "").trim().toLowerCase() ?? "";

    if (heading.includes("architect") || heading.includes("overview")) {
      // Extract first meaningful paragraph
      const lines = section.split("\n").filter(l => l.trim().length > 10 && !l.startsWith("#"));
      result.architecture = lines[0]?.slice(0, 100) ?? "";
    } else if (heading.includes("pattern") || heading.includes("approach")) {
      // Extract bullet points
      const bullets = section.split("\n")
        .filter(l => l.match(/^[-*]\s/))
        .map(l => l.replace(/^[-*]\s/, "").trim().slice(0, 30));
      result.patterns = bullets.slice(0, 5);
    } else if (heading.includes("constraint") || heading.includes("limit")) {
      const bullets = section.split("\n")
        .filter(l => l.match(/^[-*]\s/))
        .map(l => l.replace(/^[-*]\s/, "").trim().slice(0, 50));
      result.constraints = bullets.slice(0, 5);
    } else if (heading.includes("interface") || heading.includes("api")) {
      // Extract function/class signatures
      const sigs = section.match(/\w+\([^)]*\)/g) ?? [];
      result.interfaces = sigs.slice(0, 10);
    } else if (heading.includes("data") || heading.includes("flow")) {
      const lines = section.split("\n").filter(l => l.trim().length > 10 && !l.startsWith("#"));
      result.dataFlow = lines[0]?.slice(0, 200) ?? "";
    }
  }

  return result;
}

function compressTask(task: WorkflowTask): CompressedTask {
  return {
    id: task.id,
    title: task.title.slice(0, 60),
    desc: task.description.slice(0, 80),
    diff: task.difficulty,
    deps: task.dependencies,
    files: task.files,
  };
}

// ─── Main Compressor ───

export class SpecCompressor {
  private previousSpec: string | null = null;

  /**
   * Compress a full WorkflowSpec into a token-efficient representation.
   */
  compress(spec: WorkflowSpec): CompressedSpec {
    const originalText = spec.proposal + spec.design + JSON.stringify(spec.tasks);
    const originalTokens = estimateTokens(originalText);

    const proposal = compressProposal(spec.proposal);
    const design = compressDesign(spec.design);
    const tasks = spec.tasks.map(compressTask);

    const compressedText = proposal +
      JSON.stringify(design) +
      JSON.stringify(tasks);
    const compressedTokens = estimateTokens(compressedText);

    return {
      proposal,
      design,
      tasks,
      compressionRatio: originalTokens > 0 ? compressedTokens / originalTokens : 0,
      originalTokens,
      compressedTokens,
    };
  }

  /**
   * Delta compression — only send what changed since last spec.
   * Returns null if no previous spec (first call).
   */
  compressDelta(spec: WorkflowSpec): { changed: string; unchanged: number } | null {
    const currentHash = JSON.stringify(spec);
    if (!this.previousSpec) {
      this.previousSpec = currentHash;
      return null; // First call, no delta
    }

    if (currentHash === this.previousSpec) {
      return { changed: "NO_CHANGE", unchanged: 1 };
    }

    // Find changed tasks
    const prevSpec = JSON.parse(this.previousSpec) as WorkflowSpec;
    const changedTasks = spec.tasks.filter((t, i) => {
      const prev = prevSpec.tasks[i];
      return !prev || JSON.stringify(t) !== JSON.stringify(prev);
    });

    this.previousSpec = currentHash;
    return {
      changed: changedTasks.length > 0
        ? `Tasks changed: ${changedTasks.map(t => t.id).join(", ")}`
        : "Spec metadata changed (proposal/design)",
      unchanged: spec.tasks.length - changedTasks.length,
    };
  }

  /**
   * Convert compressed spec to a flat string for LLM injection.
   * Format is optimized for token efficiency.
   */
  toFlatString(compressed: CompressedSpec): string {
    const parts: string[] = [];

    // Proposal (compact)
    parts.push(`## Proposal\n${compressed.proposal}`);

    // Design (structured)
    const d = compressed.design;
    parts.push(`## Design\nArch: ${d.architecture}`);
    if (d.patterns.length > 0) parts.push(`Patterns: ${d.patterns.join(", ")}`);
    if (d.constraints.length > 0) parts.push(`Constraints: ${d.constraints.join("; ")}`);
    if (d.interfaces.length > 0) parts.push(`APIs: ${d.interfaces.join("; ")}`);
    if (d.dataFlow) parts.push(`Flow: ${d.dataFlow}`);

    // Tasks (tabular — most token-efficient)
    if (compressed.tasks.length > 0) {
      parts.push("## Tasks");
      parts.push(compressed.tasks.map(t =>
        `${t.id}|${t.title}|${t.diff}|deps:${t.deps.join(",") || "none"}|files:${t.files.join(",") || "tbd"}`
      ).join("\n"));
    }

    // Metadata
    parts.push(`[_${Math.round(compressed.compressionRatio * 100)}% of original_${compressed.compressedTokens}tok_]`);

    return parts.join("\n");
  }

  /**
   * Get a summary string for trajectory/logging (ultra-compact).
   */
  toSummary(compressed: CompressedSpec): string {
    return `Spec: ${compressed.tasks.length} tasks, ${compressed.compressedTokens}tok (${Math.round(compressed.compressionRatio * 100)}%)`;
  }
}
