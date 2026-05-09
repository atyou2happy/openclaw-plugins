// v27 Bridge — Unified facade for all v27 modules
// FF-driven initialization, zero cost when off.
// Follows v24-bridge and v25-bridge patterns.

import { LSPCodeIntelligence } from './lsp-code-intelligence.js';
import { SpecGraduation } from './spec-graduation.js';
import { VibeSpecCapture } from './vibe-spec-capture.js';
import { AgentMessageBus } from './agent-message-bus.js';
import { PhaseMemoryManager } from './phase-memory-manager.js';
import { TokenBudgetPool } from './token-budget-pool.js';
import { CostTracker } from './cost-tracker.js';
import { WorkflowFitness } from './workflow-fitness.js';
import { WorkflowExperiment } from './workflow-experiment.js';

export interface V27Config {
  lspCodeIntelligence: boolean;
  specGraduation: boolean;
  agentCollaborationProtocol: boolean;
  phaseSharedMemory: boolean;
  costAwareScheduling: boolean;
  costQualityTiers: boolean;
  metaOptimization: boolean;
  workflowExperiments: boolean;
}

export class V27Bridge {
  readonly lspCodeIntelligence: LSPCodeIntelligence | null;
  readonly specGraduation: SpecGraduation | null;
  readonly vibeSpecCapture: VibeSpecCapture | null;
  readonly agentMessageBus: AgentMessageBus | null;
  readonly phaseMemoryManager: PhaseMemoryManager | null;
  readonly tokenBudgetPool: TokenBudgetPool;
  readonly costTracker: CostTracker;
  readonly workflowFitness: WorkflowFitness | null;
  readonly workflowExperiment: WorkflowExperiment | null;

  private initialized = false;

  constructor(config: V27Config) {
    this.lspCodeIntelligence = config.lspCodeIntelligence ? new LSPCodeIntelligence() : null;
    this.specGraduation = config.specGraduation ? new SpecGraduation() : null;
    this.vibeSpecCapture = config.specGraduation ? new VibeSpecCapture() : null;
    this.agentMessageBus = config.agentCollaborationProtocol ? new AgentMessageBus() : null;
    this.phaseMemoryManager = config.phaseSharedMemory ? new PhaseMemoryManager() : null;
    // Always available — lightweight, zero external deps
    this.tokenBudgetPool = new TokenBudgetPool();
    this.costTracker = new CostTracker();
    this.workflowFitness = config.metaOptimization ? new WorkflowFitness() : null;
    this.workflowExperiment = config.workflowExperiments ? new WorkflowExperiment() : null;
  }

  /** Initialize v27 modules */
  initialize(): void {
    if (this.initialized) return;

    if (this.tokenBudgetPool) {
      // Register standard 12 steps with balanced allocation
      const stepBudget = Math.floor(180_000 / 12);
      const steps = [
        'step1-project-identify', 'step2-handover', 'step3-requirement',
        'step4-spec', 'step5-tech-selection', 'step6-plan-gate',
        'step7-development', 'step8-review', 'step9-test',
        'step10-security-audit', 'step11-docs', 'step12-delivery',
      ];
      steps.forEach(s => this.tokenBudgetPool.registerStep(s, stepBudget));
    }

    this.initialized = true;
  }

  isInitialized(): boolean {
    return this.initialized;
  }

  /** Get status summary of all v27 modules */
  getStatus(): {
    initialized: boolean;
    modules: Record<string, boolean>;
  } {
    return {
      initialized: this.initialized,
      modules: {
        lspCodeIntelligence: this.lspCodeIntelligence !== null,
        specGraduation: this.specGraduation !== null,
        vibeSpecCapture: this.vibeSpecCapture !== null,
        agentMessageBus: this.agentMessageBus !== null,
        phaseMemoryManager: this.phaseMemoryManager !== null,
        tokenBudgetPool: this.tokenBudgetPool !== null,
        costTracker: this.costTracker !== null,
        workflowFitness: this.workflowFitness !== null,
        workflowExperiment: this.workflowExperiment !== null,
      },
    };
  }

  /** Export v27 module statistics for Step 12 delivery */
  exportStatistics(): Record<string, unknown> {
    const stats: Record<string, unknown> = {};
    if (this.lspCodeIntelligence) {
      stats.lspCodeIntelligence = this.lspCodeIntelligence.getStatistics();
    }
    if (this.specGraduation) {
      stats.specGraduation = this.specGraduation.getStatistics();
    }
    if (this.vibeSpecCapture) {
      stats.vibeSpecCapture = this.vibeSpecCapture.getStatistics();
    }
    if (this.agentMessageBus) {
      stats.agentMessageBus = this.agentMessageBus.getStatistics();
    }
    if (this.phaseMemoryManager) {
      stats.phaseMemoryManager = this.phaseMemoryManager.getStatistics();
    }
    if (this.tokenBudgetPool) {
      stats.tokenBudgetPool = this.tokenBudgetPool.getStatistics();
    }
    if (this.costTracker) {
      stats.costTracker = this.costTracker.getStatistics();
    }
    if (this.workflowFitness) {
      stats.workflowFitness = this.workflowFitness.getStatistics();
    }
    if (this.workflowExperiment) {
      stats.workflowExperiment = this.workflowExperiment.getStatistics();
    }
    return stats;
  }
}
