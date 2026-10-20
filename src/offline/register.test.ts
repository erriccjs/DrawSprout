import { afterEach, describe, expect, it, vi } from 'vitest';
import { BUNDLED_LESSONS } from '../lesson-data';
import { GET_STATUS, SKIP_WAITING } from './messages';
import {
  registerOffline,
  shouldRegisterServiceWorker,
  type RegistrationLike,
  type WorkerContainerLike,
  type WorkerLike,
} from './register';

const requiredLessons = BUNDLED_LESSONS.map((lesson) => ({
  id: lesson.id,
  contentVersion: lesson.contentVersion,
}));

class FakeWorker implements WorkerLike {
  state = 'parsed';
  readonly messages: unknown[] = [];
  private readonly listeners = new Set<() => void>();

  postMessage(message: unknown): void {
    this.messages.push(message);
  }

  addEventListener(_type: 'statechange', listener: () => void): void {
    this.listeners.add(listener);
  }

  removeEventListener(_type: 'statechange', listener: () => void): void {
    this.listeners.delete(listener);
  }

  setState(state: string): void {
    this.state = state;
    for (const listener of this.listeners) listener();
  }
}

class FakeRegistration implements RegistrationLike {
  active: FakeWorker | null = null;
  waiting: FakeWorker | null = null;
  installing: FakeWorker | null = null;
  updateCount = 0;
  updateError: Error | null = null;
  private readonly listeners = new Set<() => void>();

  update(): Promise<void> {
    this.updateCount += 1;
    return this.updateError ? Promise.reject(this.updateError) : Promise.resolve();
  }

  addEventListener(_type: 'updatefound', listener: () => void): void {
    this.listeners.add(listener);
  }

  removeEventListener(_type: 'updatefound', listener: () => void): void {
    this.listeners.delete(listener);
  }

  fireUpdateFound(): void {
    for (const listener of this.listeners) listener();
  }
}

class FakeContainer implements WorkerContainerLike {
  controller: WorkerLike | null = null;
  readonly registration = new FakeRegistration();
  failRegister = false;
  readonly registered: { url: string; options: { scope: string; updateViaCache: 'none' } }[] = [];
  private readonly controllerListeners = new Set<() => void>();
  private readonly messageListeners = new Set<(event: MessageEvent) => void>();

  register(scriptUrl: string, options: { scope: string; updateViaCache: 'none' }): Promise<RegistrationLike> {
    this.registered.push({ url: scriptUrl, options });
    return this.failRegister
      ? Promise.reject(new Error('registration blocked'))
      : Promise.resolve(this.registration);
  }

  addEventListener(type: 'controllerchange', listener: () => void): void;
  addEventListener(type: 'message', listener: (event: MessageEvent) => void): void;
  addEventListener(type: 'controllerchange' | 'message', listener: ((event: MessageEvent) => void) | (() => void)): void {
    if (type === 'controllerchange') this.controllerListeners.add(listener as () => void);
    else this.messageListeners.add(listener as (event: MessageEvent) => void);
  }

  removeEventListener(type: 'controllerchange', listener: () => void): void;
  removeEventListener(type: 'message', listener: (event: MessageEvent) => void): void;
  removeEventListener(type: 'controllerchange' | 'message', listener: ((event: MessageEvent) => void) | (() => void)): void {
    if (type === 'controllerchange') this.controllerListeners.delete(listener as () => void);
    else this.messageListeners.delete(listener as (event: MessageEvent) => void);
  }

  changeController(): void {
    for (const listener of this.controllerListeners) listener();
  }

  deliver(data: unknown): void {
    const event = { data } as MessageEvent;
    for (const listener of this.messageListeners) listener(event);
  }
}

function start(container: FakeContainer, reload = vi.fn()) {
  const onReady = vi.fn();
  const onWaiting = vi.fn();
  const registered = registerOffline(container, {
    requiredLessons,
    onReady,
    onWaiting,
    reload,
  });
  return { registered, onReady, onWaiting, reload };
}

describe('service worker registration', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('registers only for a production build that has the API', () => {
    expect(shouldRegisterServiceWorker({ production: true, supported: true })).toBe(true);
    expect(shouldRegisterServiceWorker({ production: false, supported: true })).toBe(false);
    expect(shouldRegisterServiceWorker({ production: true, supported: false })).toBe(false);
  });

  it('registers at the origin root and does not reload when the first worker claims the page', async () => {
    const container = new FakeContainer();
    const { registered, reload } = start(container);
    await registered.settled;

    expect(container.registered).toEqual([
      { url: '/sw.js', options: { scope: '/', updateViaCache: 'none' } },
    ]);
    container.changeController();
    expect(reload).not.toHaveBeenCalled();
    registered.dispose();
  });

  it('reports a waiting worker without asking it to take over', async () => {
    const container = new FakeContainer();
    container.controller = new FakeWorker();
    const waiting = new FakeWorker();
    waiting.state = 'installed';
    container.registration.waiting = waiting;
    const { registered, onWaiting } = start(container);
    await registered.settled;

    expect(onWaiting).toHaveBeenCalledOnce();
    expect(waiting.messages).not.toContainEqual(SKIP_WAITING);
    registered.dispose();
  });

  it('asks the waiting worker to take over only after applyUpdate, then reloads once', async () => {
    const container = new FakeContainer();
    container.controller = new FakeWorker();
    const waiting = new FakeWorker();
    waiting.state = 'installed';
    container.registration.waiting = waiting;
    const { registered, reload } = start(container);
    await registered.settled;

    registered.applyUpdate();
    expect(waiting.messages).toContainEqual(SKIP_WAITING);
    container.changeController();
    container.changeController();
    expect(reload).toHaveBeenCalledOnce();
    registered.dispose();
  });

  it('keeps an apply that arrived before registration and sends it when the worker is waiting', async () => {
    let resolveRegister: (registration: RegistrationLike) => void = () => {};
    const container = new FakeContainer();
    container.register = (scriptUrl, options) => {
      container.registered.push({ url: scriptUrl, options });
      return new Promise((resolve) => {
        resolveRegister = resolve;
      });
    };
    container.controller = new FakeWorker();
    const waiting = new FakeWorker();
    waiting.state = 'installed';
    container.registration.waiting = waiting;

    const { registered } = start(container);
    registered.applyUpdate();
    expect(waiting.messages).toEqual([]);

    resolveRegister(container.registration);
    await registered.settled;
    expect(waiting.messages).toContainEqual(SKIP_WAITING);
    registered.dispose();
  });

  it('does not treat the first install as an update, even if the worker is briefly waiting', async () => {
    const container = new FakeContainer();
    const installing = new FakeWorker();
    installing.state = 'installing';
    container.registration.installing = installing;
    const { registered, onWaiting } = start(container);
    await registered.settled;

    container.registration.waiting = installing;
    installing.setState('installed');
    expect(onWaiting).not.toHaveBeenCalled();
    expect(installing.messages).not.toContainEqual(SKIP_WAITING);
    registered.dispose();
  });

  it('notices a worker that finishes installing after the page is open', async () => {
    const container = new FakeContainer();
    container.controller = new FakeWorker();
    const installing = new FakeWorker();
    installing.state = 'installing';
    container.registration.installing = installing;
    const { registered, onWaiting } = start(container);
    await registered.settled;

    container.registration.fireUpdateFound();
    installing.setState('installed');
    expect(onWaiting).not.toHaveBeenCalled();

    container.registration.waiting = installing;
    installing.setState('installed');
    expect(onWaiting).toHaveBeenCalledOnce();
    expect(installing.messages).not.toContainEqual(SKIP_WAITING);
    registered.dispose();
  });

  it('marks the shell ready only when the reported lessons cover the running build', async () => {
    const container = new FakeContainer();
    const active = new FakeWorker();
    container.registration.active = active;
    const { registered, onReady } = start(container);
    await registered.settled;

    expect(active.messages).toContainEqual(GET_STATUS);
    container.deliver({ type: 'OFFLINE_READY', lessons: requiredLessons.slice(1) });
    container.deliver({ type: 'OFFLINE_READY', lessons: [{ id: 'nope' }] });
    expect(onReady).not.toHaveBeenCalled();

    container.deliver({ type: 'OFFLINE_READY', lessons: requiredLessons });
    expect(onReady).toHaveBeenCalledOnce();
    registered.dispose();
  });

  it('logs a failed update check and still treats the existing registration as usable', async () => {
    const logged = vi.spyOn(console, 'error').mockImplementation(() => {});
    const container = new FakeContainer();
    container.registration.updateError = new Error('offline');
    const active = new FakeWorker();
    container.registration.active = active;
    const { registered, onReady } = start(container);
    await registered.settled;

    expect(active.messages).toContainEqual(GET_STATUS);
    container.deliver({ type: 'OFFLINE_READY', lessons: requiredLessons });
    expect(onReady).toHaveBeenCalledOnce();
    expect(logged).toHaveBeenCalled();
    registered.dispose();
  });

  it('logs a rejected registration and does not reload', async () => {
    const logged = vi.spyOn(console, 'error').mockImplementation(() => {});
    const container = new FakeContainer();
    container.failRegister = true;
    const { registered, reload } = start(container);
    await registered.settled;

    expect(logged).toHaveBeenCalled();
    container.changeController();
    expect(reload).not.toHaveBeenCalled();
    registered.dispose();
  });

  it('ignores controller changes after dispose', async () => {
    const container = new FakeContainer();
    container.controller = new FakeWorker();
    const waiting = new FakeWorker();
    waiting.state = 'installed';
    container.registration.waiting = waiting;
    const { registered, reload } = start(container);
    await registered.settled;
    registered.applyUpdate();
    registered.dispose();
    container.changeController();
    expect(reload).not.toHaveBeenCalled();
  });
});
