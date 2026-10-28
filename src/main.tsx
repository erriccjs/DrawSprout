import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { LocaleProvider } from './i18n/context';
import { requestPersistentStorage } from './persistence/indexeddb-store';
import './styles.css';

const host = document.getElementById('root');
if (!host) throw new Error('Root element is missing from index.html');

// The drafting page is dev-only. Production builds drop this branch, and the
// page never ships in the child's app.
if (import.meta.env.DEV && window.location.pathname === '/author') {
  void import('./authoring/mount').then(({ mountAuthor }) => mountAuthor(host));
} else {
  // Best effort, and nothing waits on the answer: PRD section 13 says not to
  // assume the permission is granted.
  void requestPersistentStorage();

  createRoot(host).render(
    <StrictMode>
      <LocaleProvider>
        <App />
      </LocaleProvider>
    </StrictMode>,
  );
}
