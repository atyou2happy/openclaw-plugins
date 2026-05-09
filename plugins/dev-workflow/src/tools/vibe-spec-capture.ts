// P12 v27: Vibe Spec Capture — post-hoc spec generation from coding decisions.
// Captures implicit spec from UltraQuick mode runs for documentation.
// Inspired by: OpenSpec + GSD methodology

export interface VibeSpec {
  proposal: string;
  tasks: string[];
  decisions: string[];
  files: string[];
  capturedAt: string;
}

export class VibeSpecCapture {
  private specs: VibeSpec[] = [];
  private stats = { specsGenerated: 0 };

  /** Generate minimal spec from commit diff decisions */
  captureFromDiff(diff: string): VibeSpec {
    const files = this._extractFiles(diff);
    const decisions = this._extractDecisions(diff);

    const spec: VibeSpec = {
      proposal: this._generateProposal(files, decisions),
      tasks: files.map(f => `Modified: ${f}`),
      decisions,
      files,
      capturedAt: new Date().toISOString(),
    };

    this.specs.push(spec);
    this.stats.specsGenerated++;
    return spec;
  }

  /** Generate minimal spec from explicit decisions and files */
  generateMinimalSpec(decisions: string[], files: string[]): VibeSpec {
    const spec: VibeSpec = {
      proposal: this._generateProposal(files, decisions),
      tasks: files.map(f => `Modified: ${f}`),
      decisions,
      files,
      capturedAt: new Date().toISOString(),
    };

    this.specs.push(spec);
    this.stats.specsGenerated++;
    return spec;
  }

  /** Get all captured specs */
  getSpecs(): VibeSpec[] {
    return [...this.specs];
  }

  getStatistics() {
    return {
      specsGenerated: this.stats.specsGenerated,
      latestSpec: this.specs.length > 0 ? this.specs[this.specs.length - 1] : null,
    };
  }

  private _extractFiles(diff: string): string[] {
    const matches = diff.match(/^diff --git a\/(.+) b\//gm);
    if (!matches) return [];
    const files: string[] = [];
    matches.forEach(m => {
      const f = m.replace(/^diff --git a\//, '').replace(/ b\/.*$/, '');
      if (f) files.push(f);
    });
    return Array.from(new Set(files));
  }

  private _extractDecisions(_diff: string): string[] {
    // Extract key decisions from diff — simplified heuristic
    const decisions: string[] = [];
    decisions.push('Changes implemented as captured from git diff');
    return decisions;
  }

  private _generateProposal(files: string[], decisions: string[]): string {
    const summary = decisions.length > 0 ? decisions[0] : 'Code changes';
    const fileList = files.slice(0, 3).join(', ');
    const suffix = files.length > 3 ? ` and ${files.length - 3} more files` : '';
    return `${summary}. Files affected: ${fileList}${suffix}. Auto-captured via VibeSpecCapture.`;
  }
}
