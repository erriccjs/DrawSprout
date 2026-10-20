/**
 * Messages between the page and the service worker.
 *
 * The page asks the worker to take over (`SKIP_WAITING`) or to report whether
 * the shell cache is complete (`GET_STATUS`). The worker answers with the
 * lesson list it precached. Anything else is ignored.
 */

import type { PrecacheLesson } from './precache';

export const SKIP_WAITING = { type: 'SKIP_WAITING' } as const;
export const GET_STATUS = { type: 'GET_STATUS' } as const;

export interface OfflineReadyMessage {
  readonly type: 'OFFLINE_READY';
  readonly lessons: readonly PrecacheLesson[];
}

export type ClientMessage = typeof SKIP_WAITING.type | typeof GET_STATUS.type;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

export function parseClientMessage(data: unknown): ClientMessage | null {
  if (!isRecord(data)) return null;
  if (data.type === SKIP_WAITING.type) return 'SKIP_WAITING';
  if (data.type === GET_STATUS.type) return 'GET_STATUS';
  return null;
}

export function parseWorkerMessage(data: unknown): OfflineReadyMessage | null {
  if (!isRecord(data) || data.type !== 'OFFLINE_READY' || !Array.isArray(data.lessons)) return null;
  const lessons: PrecacheLesson[] = [];
  for (const lesson of data.lessons) {
    if (!isRecord(lesson) || typeof lesson.id !== 'string' || typeof lesson.contentVersion !== 'string') {
      return null;
    }
    if (lesson.id.length === 0 || lesson.contentVersion.length === 0) return null;
    lessons.push({ id: lesson.id, contentVersion: lesson.contentVersion });
  }
  return { type: 'OFFLINE_READY', lessons };
}
