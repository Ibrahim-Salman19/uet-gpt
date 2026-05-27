import type { Source } from "@/lib/types";

type StreamCallback = (content: string, sources?: Source[]) => void;

class StreamRegistry {
  private listeners = new Map<string, StreamCallback>();

  register(threadId: string, callback: StreamCallback) {
    this.listeners.set(threadId, callback);
  }

  unregister(threadId: string) {
    this.listeners.delete(threadId);
  }

  update(threadId: string, content: string, sources?: Source[]) {
    const callback = this.listeners.get(threadId);
    if (callback) {
      callback(content, sources);
    }
  }
}

export const streamRegistry = new StreamRegistry();
