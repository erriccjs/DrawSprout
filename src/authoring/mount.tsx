import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { AuthorApp } from './AuthorApp';
import '../styles.css';
import './author.css';

export function mountAuthor(host: HTMLElement): void {
  createRoot(host).render(
    <StrictMode>
      <AuthorApp />
    </StrictMode>,
  );
}
