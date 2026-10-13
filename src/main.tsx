import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { requestPersistentStorage } from './persistence/indexeddb-store';
import './styles.css';

const host = document.getElementById('root');
if (!host) throw new Error('Root element is missing from index.html');

// Best effort, and nothing waits on the answer: PRD section 13 says not to
// assume the permission is granted.
void requestPersistentStorage();

createRoot(host).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
