import { describe, expect, it, vi } from 'vitest';
import { memoryGate } from './shared/limit';
import { handleUsageEvent, type UsageDataset } from './usage';

function post(body: unknown, extra?: { readonly bytes?: string; readonly gateLimit?: number }) {
  const points: unknown[] = [];
  const dataset: UsageDataset = {
    writeDataPoint(point) {
      points.push(point);
    },
  };
  const request = new Request('https://drawsprout.test/api/event', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...(extra?.bytes ? { 'content-length': extra.bytes } : {}),
    },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });
  return handleUsageEvent(request, { USAGE: dataset }, memoryGate(new Map(), extra?.gateLimit ?? 5)).then(async (response) => ({
    status: response.status,
    points,
    body: response.status === 204 ? {} : await response.json() as { code?: string },
  }));
}

describe('POST /api/event', () => {
  it('rejects an unknown event, an extra field, and an oversized body', async () => {
    const unknown = await post({ name: 'click', language: 'en', device: 'phone', returning: false });
    expect(unknown.status).toBe(400);
    expect(unknown.points).toHaveLength(0);

    const extra = await post({
      name: 'app_open',
      language: 'en',
      device: 'phone',
      returning: false,
      photo: 'secret',
    });
    expect(extra.status).toBe(400);
    expect(extra.body.code).toBe('unknown_field');

    const huge = await post(`{"pad":"${'x'.repeat(600)}"}`);
    expect(huge.status).toBe(413);
    expect(huge.points).toHaveLength(0);
  });

  it('writes only the allowlisted fields', async () => {
    const saved = await post({
      name: 'feedback_up',
      language: 'id',
      device: 'tablet',
      returning: true,
      lesson: 'cat-sitting',
    });
    expect(saved.status).toBe(204);
    expect(saved.points).toEqual([{
      indexes: ['feedback_up'],
      blobs: ['feedback_up', 'cat-sitting', 'id', 'tablet'],
      doubles: [1],
    }]);
  });

  it('stops a caller who sends too many events', async () => {
    const gate = memoryGate(new Map(), 1);
    const dataset = { writeDataPoint: vi.fn() };
    const once = () => new Request('https://drawsprout.test/api/event', {
      method: 'POST',
      body: JSON.stringify({ name: 'app_open', language: 'en', device: 'desktop', returning: false }),
    });
    expect((await handleUsageEvent(once(), { USAGE: dataset }, gate)).status).toBe(204);
    expect((await handleUsageEvent(once(), { USAGE: dataset }, gate)).status).toBe(429);
    expect(dataset.writeDataPoint).toHaveBeenCalledTimes(1);
  });
});
