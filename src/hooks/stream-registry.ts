import type { Source } from "@/lib/types";

type StreamCallback = (content: string, sources?: Source[]) => void;

class StreamRegistry {
  // Multiple listeners may observe the same thread concurrently (e.g. transient
  // double-mounts during navigation or React StrictMode in dev). Use a Set per
  // thread so registering/unregistering one listener never clobbers another.
  private listeners = new Map<string, Set<StreamCallback>>();

  register(threadId: string, callback: StreamCallback) {
    let callbacks = this.listeners.get(threadId);
    if (!callbacks) {
      callbacks = new Set();
      this.listeners.set(threadId, callbacks);
    }
    callbacks.add(callback);
  }

  unregister(threadId: string, callback: StreamCallback) {
    const callbacks = this.listeners.get(threadId);
    if (!callbacks) return;
    callbacks.delete(callback);
    if (callbacks.size === 0) {
      this.listeners.delete(threadId);
    }
  }

  update(threadId: string, content: string, sources?: Source[]) {
    const callbacks = this.listeners.get(threadId);
    if (!callbacks) return;
    for (const callback of callbacks) {
      callback(content, sources);
    }
  }
}

export const streamRegistry = new StreamRegistry();
