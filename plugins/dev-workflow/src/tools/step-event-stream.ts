// Step Event Stream — Principle #129 (v26 Pillar 9: Observable Pipeline)
// Inspired by: coreason-maco Glass Box Visualization + Ruflo observability
// Pattern: event-sourced state changes, observer subscription, timeline replay
export type StepEventType =
  | 'step:start' | 'step:complete' | 'step:skip' | 'step:error' | 'step:rollback'
  | 'gate:pass' | 'gate:fail' | 'gate:pending'
  | 'agent:spawn' | 'agent:complete' | 'agent:error'
  | 'decision:made' | 'decision:overridden'
  | 'experience:recorded' | 'experience:queried'
  | 'snapshot:created' | 'snapshot:restored'
  | 'custom';

export interface StepEvent {
  readonly id: string;
  readonly type: StepEventType;
  readonly stepId: number;
  readonly timestamp: number;
  readonly agentId?: string;
  readonly data: Record<string, unknown>;
  readonly parentId?: string;  // for causality tracking
}

export type EventSubscriber = (event: StepEvent) => void;
export type EventFilter = (event: StepEvent) => boolean;

export class StepEventStream {
  private readonly events: StepEvent[] = [];
  private readonly subscribers = new Map<string, { filter?: EventFilter; fn: EventSubscriber }>();
  private eventCounter = 0;
  private readonly maxEvents: number;

  constructor(maxEvents: number = 1000) {
    this.maxEvents = maxEvents;
  }

  // Emit an event
  emit(
    type: StepEventType,
    stepId: number,
    data: Record<string, unknown> = {},
    agentId?: string,
    parentId?: string,
  ): StepEvent {
    const event: StepEvent = {
      id: `evt-${++this.eventCounter}`,
      type,
      stepId,
      timestamp: Date.now(),
      agentId,
      data,
      parentId,
    };
    this.events.push(event);
    if (this.events.length > this.maxEvents) {
      this.events.shift();
    }
    // Notify subscribers
    for (const { filter, fn } of this.subscribers.values()) {
      if (!filter || filter(event)) {
        try { fn(event); } catch { /* subscriber errors don't break the stream */ }
      }
    }
    return event;
  }

  // Subscribe to events
  subscribe(fn: EventSubscriber, filter?: EventFilter): string {
    const id = `sub-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    this.subscribers.set(id, { filter, fn });
    return id;
  }

  unsubscribe(subscriptionId: string): boolean {
    return this.subscribers.delete(subscriptionId);
  }

  // Query events
  getEvents(filter?: EventFilter): StepEvent[] {
    return filter ? this.events.filter(filter) : [...this.events];
  }

  getEventsByStep(stepId: number): StepEvent[] {
    return this.events.filter(e => e.stepId === stepId);
  }

  getEventsByType(type: StepEventType): StepEvent[] {
    return this.events.filter(e => e.type === type);
  }

  // Causality chain — get event and all ancestors
  getCausalChain(eventId: string): StepEvent[] {
    const chain: StepEvent[] = [];
    let current = this.events.find(e => e.id === eventId);
    while (current) {
      chain.unshift(current);
      current = current.parentId
        ? this.events.find(e => e.id === current!.parentId)
        : undefined;
    }
    return chain;
  }

  // Timeline — group events by step for visualization
  getTimeline(): Map<number, StepEvent[]> {
    const timeline = new Map<number, StepEvent[]>();
    for (const event of this.events) {
      const step = timeline.get(event.stepId) || [];
      step.push(event);
      timeline.set(event.stepId, step);
    }
    return timeline;
  }

  // Statistics
  getStatistics() {
    const byType: Record<string, number> = {};
    for (const e of this.events) {
      byType[e.type] = (byType[e.type] || 0) + 1;
    }
    return {
      totalEvents: this.events.length,
      subscriberCount: this.subscribers.size,
      byType,
      stepsCovered: new Set(this.events.map(e => e.stepId)).size,
    };
  }

  // Export for debugging/visualization
  toJSON(): StepEvent[] { return [...this.events]; }

  reset(): void {
    this.events.length = 0;
    this.subscribers.clear();
    this.eventCounter = 0;
  }
}
