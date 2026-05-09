// v25 Bridge — Unified facade for all v25 modules
// Inspired by v24-bridge pattern: FF-driven initialization, zero cost when off

import { WorkflowGraph } from './workflow-graph.js';
import { TriangulationGate } from './triangulation-gate.js';
import { StepMiddleware } from './step-middleware.js';
import { AgentHealthMonitor } from './agent-health-monitor.js';
import { ExperiencePropagator } from './experience-propagator.js';
import { AgentTemplateRegistry } from './agent-template-registry.js';
import { ContextProtocol } from './context-protocol.js';
import { ExecutionSandbox } from './execution-sandbox.js';
import { StepEventStream } from './step-event-stream.js';
import { ExperienceLifecycle } from './experience-lifecycle.js';

export interface V25Config {
  workflowGraph: boolean;
  triangulationGate: boolean;
  stepMiddleware: boolean;
  experiencePropagation: boolean;
}

export class V25Bridge {
  readonly workflowGraph: WorkflowGraph | null;
  readonly triangulationGate: TriangulationGate | null;
  readonly stepMiddleware: StepMiddleware | null;
  readonly healthMonitor: AgentHealthMonitor | null;
  readonly experiencePropagator: ExperiencePropagator | null;
  readonly templateRegistry: AgentTemplateRegistry | null;
  readonly contextProtocol: ContextProtocol | null;
  readonly executionSandbox: ExecutionSandbox | null;
  readonly eventStream: StepEventStream | null;
  readonly experienceLifecycle: ExperienceLifecycle | null;

  private initialized = false;

  constructor(config: V25Config) {
    // Initialize only enabled modules
    this.workflowGraph = config.workflowGraph ? new WorkflowGraph() : null;
    this.triangulationGate = config.triangulationGate ? new TriangulationGate() : null;
    this.stepMiddleware = config.stepMiddleware ? new StepMiddleware() : null;
    this.healthMonitor = config.stepMiddleware ? new AgentHealthMonitor() : null;
    this.experiencePropagator = config.experiencePropagation ? new ExperiencePropagator() : null;
    this.templateRegistry = config.experiencePropagation ? new AgentTemplateRegistry() : null;
    // ContextProtocol always available (lightweight, no external deps)
    this.contextProtocol = new ContextProtocol();
    // v26 modules always available (zero external deps, lightweight)
    this.executionSandbox = new ExecutionSandbox();
    this.eventStream = new StepEventStream();
    this.experienceLifecycle = new ExperienceLifecycle();
  }

  /** Initialize v25 modules — register built-in templates, middleware, etc. */
  initialize(): void {
    if (this.initialized) return;

    if (this.templateRegistry) {
      this.templateRegistry.registerBuiltIns();
    }

    if (this.stepMiddleware) {
      // Register default global middleware
      this.stepMiddleware.registerGlobalBefore('logging', StepMiddleware.loggingMiddleware(), 10);
      this.stepMiddleware.registerGlobalAfter('timing', StepMiddleware.timingMiddleware(), 10);
    }

    if (this.workflowGraph) {
      // Pre-build standard graph
      WorkflowGraph.STANDARD();
    }

    this.initialized = true;
  }

  /** Get initialization status */
  isInitialized(): boolean {
    return this.initialized;
  }

  /** Get status summary of all v25 modules */
  getStatus(): {
    initialized: boolean;
    modules: Record<string, boolean>;
  } {
    return {
      initialized: this.initialized,
      modules: {
        workflowGraph: this.workflowGraph !== null,
        triangulationGate: this.triangulationGate !== null,
        stepMiddleware: this.stepMiddleware !== null,
        healthMonitor: this.healthMonitor !== null,
        experiencePropagator: this.experiencePropagator !== null,
        templateRegistry: this.templateRegistry !== null,
        contextProtocol: this.contextProtocol !== null,
        executionSandbox: this.executionSandbox !== null,
        eventStream: this.eventStream !== null,
        experienceLifecycle: this.experienceLifecycle !== null,
      },
    };
  }

  /** Export v25 module statistics for Step 12 delivery */
  exportStatistics(): Record<string, unknown> {
    const stats: Record<string, unknown> = {};
    if (this.triangulationGate) {
      stats.triangulationGate = this.triangulationGate.getStatistics();
    }
    if (this.healthMonitor) {
      stats.healthMonitor = this.healthMonitor.getStatistics();
    }
    if (this.experiencePropagator) {
      stats.experiencePropagator = this.experiencePropagator.getStatistics();
    }
    if (this.templateRegistry) {
      stats.templateRegistry = this.templateRegistry.getStatistics();
    }
    if (this.contextProtocol) {
      stats.contextProtocol = this.contextProtocol.getStatistics();
    }
    if (this.executionSandbox) {
      stats.executionSandbox = this.executionSandbox.getStatistics();
    }
    if (this.eventStream) {
      stats.eventStream = this.eventStream.getStatistics();
    }
    if (this.experienceLifecycle) {
      stats.experienceLifecycle = this.experienceLifecycle.getStatistics();
    }
    return stats;
  }
}
