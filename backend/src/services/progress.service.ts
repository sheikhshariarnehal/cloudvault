import { EventEmitter } from "events";

/**
 * In-memory registry of upload progress emitters.
 * Each active upload gets its own EventEmitter keyed by a client-generated UUID.
 * The SSE route subscribes to it; the upload controller emits "progress" events.
 */
const emitters = new Map<string, EventEmitter>();

export function createProgressEmitter(uploadId: string): EventEmitter {
  const emitter = new EventEmitter();
  emitter.setMaxListeners(2); // one SSE subscriber + one controller emitter
  emitters.set(uploadId, emitter);
  return emitter;
}

export function getProgressEmitter(uploadId: string): EventEmitter | undefined {
  return emitters.get(uploadId);
}

export function deleteProgressEmitter(uploadId: string): void {
  const emitter = emitters.get(uploadId);
  if (emitter) {
    emitter.removeAllListeners();
    emitters.delete(uploadId);
  }
}
