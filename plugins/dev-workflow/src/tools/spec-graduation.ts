// P12 v27: Spec Graduation — progressive spec refinement
// Three-level spec: minimal → standard → full, auto-graduation on complexity triggers.
// Inspired by: OpenSpec (Fission AI) + GSD methodology

export type SpecLevel = 'minimal' | 'standard' | 'full';

export interface GraduationContext {
  fileCount: number;
  newModules: boolean;
  archImpact: boolean;
  userForced?: SpecLevel;
}

export interface GraduationDecision {
  from: SpecLevel;
  to: SpecLevel;
  reason: string;
  trigger: 'file_count' | 'new_module' | 'arch_impact' | 'user_forced' | 'unchanged';
}

const THRESHOLDS = {
  minimalToStandardFiles: 3,
  standardToFullFiles: 10,
} as const;

export class SpecGraduation {
  private history: GraduationDecision[] = [];
  private stats = { graduations: 0, refinements: 0 };

  /** Determine starting spec level based on project context */
  determineSpecLevel(ctx: GraduationContext): SpecLevel {
    if (ctx.userForced) return ctx.userForced;
    if (ctx.archImpact || ctx.fileCount >= THRESHOLDS.standardToFullFiles) return 'full';
    if (ctx.newModules || ctx.fileCount >= THRESHOLDS.minimalToStandardFiles) return 'standard';
    return 'minimal';
  }

  /** Check if current spec level should graduate given new complexity */
  shouldGraduate(currentLevel: SpecLevel, ctx: GraduationContext): GraduationDecision {
    const decision: GraduationDecision = {
      from: currentLevel,
      to: currentLevel,
      reason: '',
      trigger: 'unchanged',
    };

    if (currentLevel === 'minimal') {
      if (ctx.archImpact) {
        decision.to = 'full';
        decision.reason = 'Architecture impact detected — graduating to full spec';
        decision.trigger = 'arch_impact';
      } else if (ctx.newModules || ctx.fileCount >= THRESHOLDS.minimalToStandardFiles) {
        decision.to = 'standard';
        decision.reason = ctx.newModules
          ? 'New module creation detected — graduating to standard spec'
          : `File count (${ctx.fileCount}) exceeds minimal threshold (${THRESHOLDS.minimalToStandardFiles})`;
        decision.trigger = 'new_module';
      }
    }

    if (currentLevel === 'standard') {
      if (ctx.archImpact || ctx.fileCount >= THRESHOLDS.standardToFullFiles) {
        decision.to = 'full';
        decision.reason = ctx.archImpact
          ? 'Architecture impact detected — graduating to full spec'
          : `File count (${ctx.fileCount}) exceeds standard threshold (${THRESHOLDS.standardToFullFiles})`;
        decision.trigger = 'arch_impact';
      }
    }

    if (ctx.userForced) {
      decision.to = ctx.userForced;
      decision.reason = `User forced spec level: ${ctx.userForced}`;
      decision.trigger = 'user_forced';
    }

    if (decision.to !== currentLevel) {
      this.stats.graduations++;
      this.history.push(decision);
    }

    return decision;
  }

  /** Record a spec refinement event */
  recordRefinement(reason: string): void {
    this.stats.refinements++;
    this.history.push({
      from: 'minimal',
      to: 'minimal',
      reason,
      trigger: 'unchanged',
    });
  }

  /** Get graduation history */
  getHistory(): GraduationDecision[] {
    return [...this.history];
  }

  getStatistics() {
    return {
      graduations: this.stats.graduations,
      refinements: this.stats.refinements,
      historyLength: this.history.length,
    };
  }
}

export const DEFAULT_SPEC_LEVEL: SpecLevel = 'minimal';
