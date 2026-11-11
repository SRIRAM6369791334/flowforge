import type { Execution } from "./types";

export type WorkflowEventType = "start" | "progress" | "complete" | "error";

export interface WorkflowEvent {
  type: WorkflowEventType;
  executionId: string;
  workflowId: string;
  workflowName: string;
  mode: Execution["mode"];
  triggerData?: Record<string, unknown>;
  execution?: Execution;
  activeNodeIds?: string[];
  timestamp: string;
}

type Listener = (evt: WorkflowEvent) => void;

class EventBus {
  private listeners = new Set<Listener>();
  private recentEvents: WorkflowEvent[] = [];

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  broadcast(evt: WorkflowEvent): void {
    this.recentEvents.unshift(evt);
    if (this.recentEvents.length > 50) this.recentEvents.pop();
    for (const fn of this.listeners) {
      try {
        fn(evt);
      } catch {
        // ignore
      }
    }
  }

  getRecent(): WorkflowEvent[] {
    return this.recentEvents;
  }
}

const g = globalThis as unknown as { __ffEventBus?: EventBus };
export const workflowBus = (g.__ffEventBus ??= new EventBus());
