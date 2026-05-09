// P13 v27: Agent Message Bus — typed inter-agent communication.
// Replaces ad-hoc ContractLayer (v16) with structured typed messages.
// Inspired by: ChatDev ChatChain + OpenHermit agent-as-service

export type MessageType = 'request' | 'response' | 'event' | 'error';

export interface AgentMessage {
  id: string;
  type: MessageType;
  sender: string;
  recipient: string;
  correlationId?: string;
  timestamp: string;
  payload: unknown;
}

export interface MessageStats {
  sent: number;
  received: number;
  errors: number;
  byType: Record<MessageType, number>;
}

export class AgentMessageBus {
  private handlers: Map<string, Array<(msg: AgentMessage) => void>> = new Map();
  private history: AgentMessage[] = [];
  private stats: MessageStats = { sent: 0, received: 0, errors: 0, byType: { request: 0, response: 0, event: 0, error: 0 } };

  /** Send a message to a recipient */
  send(sender: string, recipient: string, type: MessageType, payload: unknown, correlationId?: string): AgentMessage {
    const msg: AgentMessage = {
      id: this._generateId(),
      type,
      sender,
      recipient,
      correlationId,
      timestamp: new Date().toISOString(),
      payload,
    };

    this.history.push(msg);
    this.stats.sent++;
    this.stats.byType[type] = (this.stats.byType[type] || 0) + 1;

    // Notify handlers
    const recipientHandlers = this.handlers.get(recipient);
    if (recipientHandlers) {
      recipientHandlers.forEach(h => {
        try {
          h(msg);
        } catch {
          this.stats.errors++;
        }
      });
    }

    return msg;
  }

  /** Subscribe to messages for a recipient */
  subscribe(recipient: string, handler: (msg: AgentMessage) => void): void {
    const existing = this.handlers.get(recipient);
    if (existing) {
      existing.push(handler);
    } else {
      this.handlers.set(recipient, [handler]);
    }
  }

  /** Unsubscribe a handler */
  unsubscribe(recipient: string, handler: (msg: AgentMessage) => void): void {
    const existing = this.handlers.get(recipient);
    if (existing) {
      this.handlers.set(recipient, existing.filter(h => h !== handler));
    }
  }

  /** Get message history for a recipient */
  getHistory(recipient?: string): AgentMessage[] {
    if (!recipient) return [...this.history];
    return this.history.filter(m => m.recipient === recipient || m.sender === recipient);
  }

  /** Get messages by correlationId */
  getByCorrelation(correlationId: string): AgentMessage[] {
    return this.history.filter(m => m.correlationId === correlationId);
  }

  /** Clear message history */
  clear(): void {
    this.history = [];
  }

  getStatistics() {
    return { ...this.stats, historyLength: this.history.length };
  }

  private _generateId(): string {
    return `msg-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  }
}
