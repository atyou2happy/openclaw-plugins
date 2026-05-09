// Inspired by: Claude Orchestra (47 specialized agents in 10 teams),
// CrewAI (Agent role/goal/backstory + YAML config),
// AG2 (ConversableAgent + description-based routing)
// v25 Enhancement: Agent Template Registry

export type AgentTier = 'lightweight' | 'standard' | 'advanced' | 'critical';

export interface AgentTemplate {
  name: string;
  capabilities: string[];
  tier: AgentTier;
  systemPromptTemplate: string;
  tools: string[];
  modelRequirements: { minContextWindow?: number; supportsJSON?: boolean };
  category: string;
}

export interface TemplateMatch {
  template: AgentTemplate;
  /** Capability overlap ratio */
  overlap: number;
  /** Tier compatibility score */
  tierScore: number;
  /** Combined match score */
  score: number;
}

export class AgentTemplateRegistry {
  private templates: Map<string, AgentTemplate> = new Map();

  // ─── Registration ───

  register(template: AgentTemplate): void {
    if (!template?.name) throw new Error('Template must have a name');
    this.templates.set(template.name, template);
  }

  unregister(name: string): boolean {
    return this.templates.delete(name);
  }

  // ─── Query ───

  get(name: string): AgentTemplate | undefined {
    return this.templates.get(name);
  }

  getAll(): AgentTemplate[] {
    return Array.from(this.templates.values());
  }

  getByCategory(category: string): AgentTemplate[] {
    return Array.from(this.templates.values()).filter(t => t.category === category);
  }

  getByCapability(capability: string): AgentTemplate[] {
    return Array.from(this.templates.values()).filter(
      t => t.capabilities.some(c => c.toLowerCase() === capability.toLowerCase()),
    );
  }

  /** Match templates by required capabilities, sorted by relevance */
  match(requirements: string[]): TemplateMatch[] {
    const results: TemplateMatch[] = [];
    for (const template of this.templates.values()) {
      const capSet = new Set(template.capabilities.map(c => c.toLowerCase()));
      const reqSet = new Set(requirements.map(r => r.toLowerCase()));
      const overlap = [...reqSet].filter(r => capSet.has(r)).length / Math.max(reqSet.size, 1);
      const tierScore = { critical: 1.0, advanced: 0.8, standard: 0.6, lightweight: 0.4 }[template.tier];
      results.push({
        template,
        overlap,
        tierScore,
        score: overlap * 0.7 + tierScore * 0.3,
      });
    }
    return results.sort((a, b) => b.score - a.score);
  }

  // ─── Built-in Templates ───

  static BUILT_IN_TEMPLATES: AgentTemplate[] = [
    {
      name: 'coder',
      capabilities: ['coding', 'implementation', 'refactoring', 'python', 'typescript'],
      tier: 'standard',
      systemPromptTemplate: 'You are an expert coder. Implement the task with clean code.',
      tools: ['terminal', 'file', 'patch'],
      modelRequirements: { minContextWindow: 8000 },
      category: 'development',
    },
    {
      name: 'reviewer',
      capabilities: ['review', 'security', 'code-quality', 'architecture'],
      tier: 'advanced',
      systemPromptTemplate: 'You are a senior code reviewer. Find issues with [P0-P3] severity ratings.',
      tools: ['file', 'terminal'],
      modelRequirements: { minContextWindow: 16000, supportsJSON: true },
      category: 'quality',
    },
    {
      name: 'security-architect',
      capabilities: ['security', 'owasp', 'threat-modeling', 'compliance'],
      tier: 'critical',
      systemPromptTemplate: 'You are a security architect. Audit for OWASP Top 10 and STRIDE threats.',
      tools: ['file', 'terminal'],
      modelRequirements: { minContextWindow: 32000 },
      category: 'security',
    },
    {
      name: 'tester',
      capabilities: ['testing', 'unit-test', 'integration-test', 'coverage'],
      tier: 'standard',
      systemPromptTemplate: 'You are a testing specialist. Write comprehensive tests following the pyramid model.',
      tools: ['terminal', 'file'],
      modelRequirements: { minContextWindow: 8000 },
      category: 'quality',
    },
    {
      name: 'debugger',
      capabilities: ['debugging', 'root-cause-analysis', 'performance-profiling'],
      tier: 'advanced',
      systemPromptTemplate: 'You are a debugger. Follow systematic root cause analysis before proposing fixes.',
      tools: ['terminal', 'file'],
      modelRequirements: { minContextWindow: 16000 },
      category: 'development',
    },
  ];

  /** Register all built-in templates */
  registerBuiltIns(): void {
    for (const t of AgentTemplateRegistry.BUILT_IN_TEMPLATES) {
      this.register(t);
    }
  }

  // ─── Statistics ───

  getStatistics(): {
    totalTemplates: number;
    byCategory: Record<string, number>;
    byTier: Record<string, number>;
    uniqueCapabilities: number;
  } {
    const byCategory: Record<string, number> = {};
    const byTier: Record<string, number> = {};
    const caps = new Set<string>();
    for (const t of this.templates.values()) {
      byCategory[t.category] = (byCategory[t.category] ?? 0) + 1;
      byTier[t.tier] = (byTier[t.tier] ?? 0) + 1;
      t.capabilities.forEach(c => caps.add(c));
    }
    return {
      totalTemplates: this.templates.size,
      byCategory,
      byTier,
      uniqueCapabilities: caps.size,
    };
  }

  // ─── Reset ───

  clear(): void {
    this.templates.clear();
  }
}
