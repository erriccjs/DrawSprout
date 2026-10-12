/**
 * App shell: resolve storage and the session, then hand over to the drawing pad.
 *
 * Milestone 1 is one lesson, so there is no catalogue and no gallery; both are
 * follow-up work recorded in docs/IMPLEMENTATION_PLAN.md.
 */

import { DrawingPad } from './ui/DrawingPad';
import { useSessionBootstrap } from './ui/useSessionBootstrap';

export function App() {
  const bootstrap = useSessionBootstrap();

  if (bootstrap.status === 'loading') {
    return (
      <main className="shell shell--centered">
        <p role="status">Menyiapkan pelajaran…</p>
      </main>
    );
  }

  if (bootstrap.status === 'error') {
    return (
      <main className="shell shell--centered">
        <h1>Pelajaran tidak dapat dibuka</h1>
        <p className="banner banner--warning">{bootstrap.message}</p>
      </main>
    );
  }

  const notice =
    bootstrap.resumeProblem ??
    (bootstrap.resumed ? 'Karya terakhirmu dilanjutkan dari tempat kamu berhenti.' : null);

  return (
    <main className="shell">
      <DrawingPad
        lesson={bootstrap.lesson}
        store={bootstrap.store}
        initialState={bootstrap.initialState}
        durable={bootstrap.durable}
        notice={notice}
      />
    </main>
  );
}
