// Inspired by: MASFactory (Graph-style Node/Edge composition),
// Microsoft Agent Framework (graph-based patterns),
// Ruflo (GOAP A* planner)
// v25 Pillar 5: Workflow Graph Engine

/** Workflow node types */
export type NodeType = 'step' | 'subgraph' | 'condition' | 'start' | 'end';

/** Edge guard predicate — return true to allow traversal */
export type EdgeGuard = (context: Record<string, unknown>) => boolean;

export interface WorkflowNode {
  id: string;
  type: NodeType;
  data: Record<string, unknown>;
  /** Subgraph reference when type='subgraph' */
  subgraph?: WorkflowGraph;
}

export interface WorkflowEdge {
  from: string;
  to: string;
  /** Optional conditional guard */
  guard?: EdgeGuard;
  /** Human-readable label */
  label?: string;
}

export interface WorkflowGraphConfig {
  name: string;
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
}

export interface ExecutionResult {
  /** Node IDs in execution order */
  order: string[];
  /** Parallel batches (batch[0] runs first, all nodes in a batch can run concurrently) */
  batches: string[][];
  /** Total nodes executed */
  executed: number;
  /** Execution metadata */
  meta: { name: string; timestamp: number };
}

export class WorkflowGraph {
  private nodes: Map<string, WorkflowNode> = new Map();
  private edges: WorkflowEdge[] = [];
  private name: string;

  constructor(config?: WorkflowGraphConfig) {
    this.name = config?.name ?? 'unnamed';
    if (config) {
      for (const n of config.nodes) this.addNode(n);
      for (const e of config.edges) this.addEdge(e);
    }
  }

  // ─── Mutation ───

  addNode(node: WorkflowNode): this {
    if (!node?.id) throw new Error('WorkflowNode must have an id');
    this.nodes.set(node.id, node);
    return this;
  }

  addEdge(edge: WorkflowEdge): this {
    if (!edge?.from || !edge?.to) throw new Error('Edge must have from and to');
    this.edges.push(edge);
    return this;
  }

  removeNode(id: string): boolean {
    if (!this.nodes.has(id)) return false;
    this.nodes.delete(id);
    this.edges = this.edges.filter(e => e.from !== id && e.to !== id);
    return true;
  }

  // ─── Query ───

  getNode(id: string): WorkflowNode | undefined {
    return this.nodes.get(id);
  }

  getEdges(): WorkflowEdge[] {
    return [...this.edges];
  }

  getOutgoing(nodeId: string): WorkflowEdge[] {
    return this.edges.filter(e => e.from === nodeId);
  }

  getIncoming(nodeId: string): WorkflowEdge[] {
    return this.edges.filter(e => e.to === nodeId);
  }

  getNodeCount(): number {
    return this.nodes.size;
  }

  // ─── Topological Sort ───

  /** Kahn's algorithm for topological sort, returns parallel batches */
  topologicalBatches(context?: Record<string, unknown>): string[][] {
    const inDegree = new Map<string, number>();
    const adjacency = new Map<string, string[]>();

    for (const [id] of this.nodes) {
      inDegree.set(id, 0);
      adjacency.set(id, []);
    }

    for (const edge of this.edges) {
      // Skip guarded edges when no context provided (conditional branches)
      if (edge.guard && !context) continue;
      if (edge.guard && context && !edge.guard(context)) continue;
      if (!this.nodes.has(edge.from) || !this.nodes.has(edge.to)) continue;
      adjacency.get(edge.from)!.push(edge.to);
      inDegree.set(edge.to, (inDegree.get(edge.to) ?? 0) + 1);
    }

    const batches: string[][] = [];
    const queue: string[] = [];

    for (const [id, deg] of inDegree) {
      if (deg === 0) queue.push(id);
    }

    let processed = 0;
    while (queue.length > 0) {
      batches.push([...queue]);
      const nextQueue: string[] = [];
      for (const id of queue) {
        for (const dep of adjacency.get(id) ?? []) {
          const newDeg = (inDegree.get(dep) ?? 1) - 1;
          inDegree.set(dep, newDeg);
          if (newDeg === 0) nextQueue.push(dep);
        }
        processed++;
      }
      queue.length = 0;
      queue.push(...nextQueue);
    }

    if (processed !== this.nodes.size) {
      throw new Error('Cycle detected in workflow graph');
    }

    return batches;
  }

  /** Flatten batches into a linear execution order */
  executionOrder(context?: Record<string, unknown>): string[] {
    return this.topologicalBatches(context).flat();
  }

  // ─── Execute (simulated) ───

  execute(context?: Record<string, unknown>): ExecutionResult {
    const batches = this.topologicalBatches(context);
    const order = batches.flat();
    return {
      order,
      batches,
      executed: order.length,
      meta: { name: this.name, timestamp: Date.now() },
    };
  }

  // ─── Visualization ───

  toMermaid(): string {
    const lines: string[] = [`graph ${this.name.replace(/\s+/g, '_')}`];
    for (const edge of this.edges) {
      const label = edge.label ? `|${edge.label}|` : '';
      lines.push(`  ${edge.from} -->${label} ${edge.to}`);
    }
    for (const [id, node] of this.nodes) {
      if (this.edges.every(e => e.from !== id && e.to !== id)) {
        lines.push(`  ${id}[${node.type}: ${id}]`);
      }
    }
    return lines.join('\n');
  }

  // ─── Serialization ───

  toJSON(): WorkflowGraphConfig {
    return {
      name: this.name,
      nodes: Array.from(this.nodes.values()).map(n => ({
        ...n,
        subgraph: n.subgraph ? (n.subgraph.toJSON() as unknown as WorkflowGraph) : undefined,
      })),
      edges: this.edges,
    };
  }

  static fromJSON(config: WorkflowGraphConfig): WorkflowGraph {
    return new WorkflowGraph(config);
  }

  // ─── Built-in Presets ───

  static ULTRA_QUICK(): WorkflowGraph {
    return new WorkflowGraph({
      name: 'UltraQuick',
      nodes: [
        { id: 'step1', type: 'step', data: { label: 'Project Identification' } },
        { id: 'step7', type: 'step', data: { label: 'Development' } },
      ],
      edges: [{ from: 'step1', to: 'step7', label: 'direct' }],
    });
  }

  static STANDARD(): WorkflowGraph {
    const steps = [
      'step1', 'step2', 'step3', 'step4', 'step5', 'step6',
      'step7', 'step8', 'step9', 'step10', 'step11', 'step12',
    ];
    const labels = [
      'Project Identification', 'Handover Recovery', 'Requirements Exploration',
      'Spec Definition', 'Tech Selection', 'Plan Gate',
      'Development', 'Code Review', 'Testing', 'Security Audit',
      'Documentation', 'Delivery',
    ];
    const nodes = steps.map((id, i) => ({
      id, type: 'step' as NodeType, data: { label: labels[i] },
    }));
    const edges: WorkflowEdge[] = steps.slice(0, -1).map((id, i) => ({
      from: id, to: steps[i + 1], label: labels[i],
    }));
    // Add conditional branch: Plan Gate rejection -> back to Step 4
    const planGateRejectionEdge: WorkflowEdge = {
      from: 'step6', to: 'step4', label: 'rejected',
    };
    planGateRejectionEdge.guard = (ctx: Record<string, unknown>) => ctx['planGateResult'] === 'rejected';
    edges.push(planGateRejectionEdge);
    // Review loop: Step 8 finds P0 -> back to Step 7
    const reviewLoopEdge: WorkflowEdge = {
      from: 'step8', to: 'step7', label: 'P0 found',
    };
    reviewLoopEdge.guard = (ctx: Record<string, unknown>) => ctx['hasP0'] === true;
    edges.push(reviewLoopEdge);
    return new WorkflowGraph({ name: 'Standard', nodes, edges });
  }

  static FULL(): WorkflowGraph {
    const graph = WorkflowGraph.STANDARD();
    graph.name = 'Full';
    // Add v24/v25 enhancement nodes
    graph.addNode({ id: 'adr_create', type: 'step', data: { label: 'Auto Create ADR', pillar: 'v24' } });
    graph.addNode({ id: 'spec_to_graph', type: 'step', data: { label: 'Spec→DAG', pillar: 'v25' } });
    graph.addNode({ id: 'triangulate', type: 'step', data: { label: 'Council Gate', pillar: 'v25' } });
    graph.addNode({ id: 'middleware_before', type: 'step', data: { label: 'Before Middleware', pillar: 'v25' } });
    graph.addNode({ id: 'middleware_after', type: 'step', data: { label: 'After Middleware', pillar: 'v25' } });
    graph.addNode({ id: 'experience_export', type: 'step', data: { label: 'Experience Export', pillar: 'v25' } });
    // Wire: Step 4 -> ADR -> SpecToGraph
    graph.addEdge({ from: 'step4', to: 'adr_create', label: 'spec→ADR' });
    graph.addEdge({ from: 'adr_create', to: 'spec_to_graph', label: 'ADR→DAG' });
    graph.addEdge({ from: 'spec_to_graph', to: 'step5', label: 'DAG→Tech' });
    // Wire: Step 6 -> Triangulate for critical ADRs
    graph.addEdge({ from: 'step6', to: 'triangulate', label: 'critical ADR',
      guard: (ctx: Record<string, unknown>) => ctx['hasCriticalADR'] === true });
    graph.addEdge({ from: 'triangulate', to: 'step7', label: 'triangulated' });
    // Wire: Middleware around Step 7 (step6 -> before -> step7 -> after)
    graph.addEdge({ from: 'step6', to: 'middleware_before', label: 'pre-middleware' });
    graph.addEdge({ from: 'middleware_before', to: 'step7', label: 'before→dev' });
    graph.addEdge({ from: 'step7', to: 'middleware_after', label: 'dev→after' });
    graph.addEdge({ from: 'middleware_after', to: 'step8', label: 'after→review' });
    // Wire: Step 12 -> Experience Export
    graph.addEdge({ from: 'step12', to: 'experience_export', label: 'export experience' });
    return graph;
  }
}
