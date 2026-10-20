import { describe, expect, it } from 'vitest';
import { GET_STATUS, SKIP_WAITING, parseClientMessage, parseWorkerMessage } from './messages';

describe('worker messages', () => {
  it('accepts the two messages the page is allowed to send', () => {
    expect(parseClientMessage(SKIP_WAITING)).toBe('SKIP_WAITING');
    expect(parseClientMessage(GET_STATUS)).toBe('GET_STATUS');
    expect(parseClientMessage({ type: 'DELETE_EVERYTHING' })).toBeNull();
    expect(parseClientMessage(null)).toBeNull();
    expect(parseClientMessage('SKIP_WAITING')).toBeNull();
  });

  it('accepts a ready report only when every lesson id and version is a string', () => {
    expect(parseWorkerMessage({
      type: 'OFFLINE_READY',
      lessons: [{ id: 'cat-sitting', contentVersion: '1.0.0' }],
    })).toEqual({
      type: 'OFFLINE_READY',
      lessons: [{ id: 'cat-sitting', contentVersion: '1.0.0' }],
    });
    expect(parseWorkerMessage({ type: 'OFFLINE_READY', lessons: [{ id: '', contentVersion: '1' }] })).toBeNull();
    expect(parseWorkerMessage({ type: 'OFFLINE_READY', lessons: [{ id: 'cat-sitting' }] })).toBeNull();
    expect(parseWorkerMessage({ type: 'OFFLINE_READY', lessons: 'cat-sitting' })).toBeNull();
    expect(parseWorkerMessage({ type: 'OTHER', lessons: [] })).toBeNull();
  });
});
