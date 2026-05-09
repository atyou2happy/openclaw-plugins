/**
 * ADR Manager — v24 Pillar 3 module
 *
 * Architecture Decision Records management.
 * Principles #110-112: ADR for every design decision,
 * Phase gate enforcement, decision event sourcing.
 *
 * Inspired by: Ruflo ADR plugin + Michael Nygard ADR pattern
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync, readdirSync } from "fs";
import { join } from "path";

// ── ADR Types ──

export type ADRStatus = "proposed" | "accepted" | "deprecated" | "superseded";
export type ADRAction = "create" | "accept" | "reject" | "supersede";
export type DecisionLevel = "critical" | "standard" | "trivial";

export interface ADR {
  id: number;
  title: string;
  status: ADRStatus;
  context: string;
  decision: string;
  consequences: string;
  level: DecisionLevel;
  supersededBy?: number;
  createdAt: string;
  updatedAt: string;
}

export interface ADREvent {
  timestamp: string;
  adrId: number;
  action: ADRAction;
  actor: string;
  reason: string;
}

export interface ADRExport {
  total: number;
  byStatus: Record<ADRStatus, number>;
  unaccepted: ADR[];
  events: ADREvent[];
}

// ── ADR Manager ──

export class ADRManager {
  private adrDir: string;
  private eventsFile: string;
  private events: ADREvent[] = [];

  constructor(projectDir: string) {
    this.adrDir = join(projectDir, "docs", "adr");
    this.eventsFile = join(projectDir, ".dev-workflow", "decisions.jsonl");
  }

  // ── Initialize ──

  init(): void {
    if (!existsSync(this.adrDir)) {
      mkdirSync(this.adrDir, { recursive: true });
    }
    if (!existsSync(join(this.adrDir, "..", "..", ".dev-workflow"))) {
      mkdirSync(join(this.adrDir, "..", "..", ".dev-workflow"), { recursive: true });
    }
    this.loadEvents();
  }

  // ── CRUD ──

  /** Create a new ADR. Principle #110 */
  create(title: string, context: string, decision: string, consequences: string, level: DecisionLevel = "standard"): ADR {
    const id = this.nextId();
    const now = new Date().toISOString();
    const adr: ADR = {
      id,
      title,
      status: "proposed",
      context,
      decision,
      consequences,
      level,
      createdAt: now,
      updatedAt: now,
    };
    this.writeADR(adr);
    this.emitEvent({ timestamp: now, adrId: id, action: "create", actor: "system", reason: "New ADR created" });
    return adr;
  }

  /** Accept an ADR. Used at Plan Gate. */
  accept(id: number, actor: string = "user", reason: string = "Plan Gate approved"): ADR | null {
    const adr = this.readADR(id);
    if (!adr) return null;
    adr.status = "accepted";
    adr.updatedAt = new Date().toISOString();
    this.writeADR(adr);
    this.emitEvent({ timestamp: adr.updatedAt, adrId: id, action: "accept", actor, reason });
    return adr;
  }

  /** Reject an ADR */
  reject(id: number, actor: string = "user", reason: string = "Rejected"): ADR | null {
    const adr = this.readADR(id);
    if (!adr) return null;
    adr.status = "deprecated";
    adr.updatedAt = new Date().toISOString();
    this.writeADR(adr);
    this.emitEvent({ timestamp: adr.updatedAt, adrId: id, action: "reject", actor, reason });
    return adr;
  }

  /** Supersede an ADR with a new one */
  supersede(oldId: number, newTitle: string, context: string, decision: string, consequences: string, reason: string): { old: ADR | null; new: ADR } {
    const old = this.readADR(oldId);
    const newAdr = this.create(newTitle, context, decision, consequences);
    newAdr.status = "accepted";
    newAdr.updatedAt = new Date().toISOString();
    this.writeADR(newAdr);

    if (old) {
      old.status = "superseded";
      old.supersededBy = newAdr.id;
      old.updatedAt = new Date().toISOString();
      this.writeADR(old);
      this.emitEvent({ timestamp: old.updatedAt, adrId: oldId, action: "supersede", actor: "system", reason });
    }
    return { old, new: newAdr };
  }

  // ── Query ──

  /** Get ADR by id */
  get(id: number): ADR | null {
    return this.readADR(id);
  }

  /** List all ADRs */
  list(): ADR[] {
    if (!existsSync(this.adrDir)) return [];
    const files = readdirSync(this.adrDir).filter(f => f.endsWith(".md")).sort();
    return files.map(f => this.readADR(parseInt(f))).filter((a): a is ADR => a !== null);
  }

  /** Get ADRs by status */
  byStatus(status: ADRStatus): ADR[] {
    return this.list().filter(a => a.status === status);
  }

  /** Phase gate check: all ADRs must be accepted. Principle #111 */
  gateCheck(): { passed: boolean; blocking: ADR[] } {
    const unaccepted = this.list().filter(a => a.status === "proposed");
    return {
      passed: unaccepted.length === 0,
      blocking: unaccepted,
    };
  }

  /** Get decision events for Retro analysis. Principle #112 */
  getEvents(since?: string): ADREvent[] {
    if (since) {
      return this.events.filter(e => e.timestamp >= since);
    }
    return [...this.events];
  }

  /** Export summary for Retro */
  export(): ADRExport {
    const all = this.list();
    const byStatus: Record<ADRStatus, number> = { proposed: 0, accepted: 0, deprecated: 0, superseded: 0 };
    for (const a of all) byStatus[a.status]++;
    return {
      total: all.length,
      byStatus,
      unaccepted: all.filter(a => a.status === "proposed"),
      events: this.events,
    };
  }

  // ── Internals ──

  private nextId(): number {
    const existing = this.list();
    if (existing.length === 0) return 1;
    return Math.max(...existing.map(a => a.id)) + 1;
  }

  private adrPath(id: number): string {
    const padded = String(id).padStart(4, "0");
    const adr = this.readADR(id);
    const slug = adr ? slugify(adr.title) : "untitled";
    return join(this.adrDir, `${padded}-${slug}.md`);
  }

  private writeADR(adr: ADR): void {
    const padded = String(adr.id).padStart(4, "0");
    const slug = slugify(adr.title);
    const path = join(this.adrDir, `${padded}-${slug}.md`);
    const content = [
      `# ${adr.id}. ${adr.title}`,
      "",
      `- **Status**: ${adr.status}${adr.supersededBy ? ` (superseded by ADR-${adr.supersededBy})` : ""}`,
      `- **Level**: ${adr.level}`,
      `- **Created**: ${adr.createdAt}`,
      `- **Updated**: ${adr.updatedAt}`,
      "",
      "## Context",
      adr.context,
      "",
      "## Decision",
      adr.decision,
      "",
      "## Consequences",
      adr.consequences,
      "",
    ].join("\n");
    writeFileSync(path, content, "utf-8");
  }

  private readADR(id: number): ADR | null {
    if (!existsSync(this.adrDir)) return null;
    const files = readdirSync(this.adrDir).filter(f => f.startsWith(String(id).padStart(4, "0") + "-") && f.endsWith(".md"));
    if (files.length === 0) return null;
    const content = readFileSync(join(this.adrDir, files[0]), "utf-8");
    return parseADR(content, id);
  }

  private emitEvent(event: ADREvent): void {
    this.events.push(event);
    const line = JSON.stringify(event) + "\n";
    const dir = join(this.adrDir, "..", "..", ".dev-workflow");
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    // Append to JSONL
    const existing = existsSync(this.eventsFile) ? readFileSync(this.eventsFile, "utf-8") : "";
    writeFileSync(this.eventsFile, existing + line, "utf-8");
  }

  private loadEvents(): void {
    if (!existsSync(this.eventsFile)) {
      this.events = [];
      return;
    }
    const content = readFileSync(this.eventsFile, "utf-8");
    this.events = content.trim().split("\n").filter(Boolean).map(line => {
      try { return JSON.parse(line); } catch { return null; }
    }).filter((e): e is ADREvent => e !== null);
  }
}

// ── Helpers ──

function slugify(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fff]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60);
}

function parseADR(content: string, id: number): ADR {
  const statusMatch = content.match(/\*\*Status\*\*:\s*(\w+)/);
  const levelMatch = content.match(/\*\*Level\*\*:\s*(\w+)/);
  const createdMatch = content.match(/\*\*Created\*\*:\s*(.+)/);
  const updatedMatch = content.match(/\*\*Updated\*\*:\s*(.+)/);
  const supersededMatch = content.match(/superseded by ADR-(\d+)/);
  const titleMatch = content.match(/^#\s+\d+\.\s+(.+)$/m);

  const sections = content.split(/^## /m);
  const getSection = (name: string): string => {
    const s = sections.find(s => s.startsWith(name));
    return s ? s.replace(new RegExp(`^${name}\\s*\\n?`), "").trim() : "";
  };

  return {
    id,
    title: titleMatch ? titleMatch[1].trim() : "Untitled",
    status: (statusMatch?.[1] as ADRStatus) || "proposed",
    context: getSection("Context"),
    decision: getSection("Decision"),
    consequences: getSection("Consequences"),
    level: (levelMatch?.[1] as DecisionLevel) || "standard",
    supersededBy: supersededMatch ? parseInt(supersededMatch[1]) : undefined,
    createdAt: createdMatch?.[1]?.trim() || new Date().toISOString(),
    updatedAt: updatedMatch?.[1]?.trim() || new Date().toISOString(),
  };
}
