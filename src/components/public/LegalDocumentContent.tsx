import { useEffect, useState } from 'react';

type LegalDocumentName = 'privacy' | 'terms' | 'delete-account';
type LoadState = 'loading' | 'ready' | 'error';

export function LegalDocumentContent({ documentName }: { documentName: LegalDocumentName }) {
  const [html, setHtml] = useState('');
  const [state, setState] = useState<LoadState>('loading');

  useEffect(() => {
    const controller = new AbortController();

    async function loadDocument() {
      try {
        const response = await fetch(`/legal/${documentName}.html`, { signal: controller.signal });
        if (!response.ok) throw new Error(`Legal document request failed (${response.status}).`);

        const source = await response.text();
        const parsed = new DOMParser().parseFromString(source, 'text/html');
        const main = parsed.querySelector('main');
        if (!main) throw new Error('The legal document has no main content.');

        main.querySelectorAll('script, style, iframe, object, embed').forEach((element) => element.remove());
        main.querySelectorAll<HTMLElement>('[class]').forEach((element) => {
          element.className = Array.from(element.classList, (className) => `legal-${className}`).join(' ');
        });
        main.querySelectorAll<HTMLAnchorElement>('a[href]').forEach((anchor) => {
          const href = anchor.getAttribute('href');
          if (!href) return;

          const destination = new URL(href, `${window.location.origin}/legal/${documentName}.html`);
          if (destination.origin === window.location.origin) {
            anchor.href = `${destination.pathname}${destination.search}${destination.hash}`;
          } else if (!['http:', 'https:', 'mailto:'].includes(destination.protocol)) {
            anchor.removeAttribute('href');
          }
        });

        setHtml(main.innerHTML);
        setState('ready');
      } catch {
        if (!controller.signal.aborted) setState('error');
      }
    }

    void loadDocument();
    return () => controller.abort();
  }, [documentName]);

  if (state === 'loading') {
    return <p className="legal-load-state" role="status">Loading the source document…</p>;
  }

  if (state === 'error') {
    return (
      <div className="info-card legal-load-error" role="alert">
        <p>We could not load this legal document. The original source is available directly:</p>
        <a className="inline-link" href={`/legal/${documentName}.html`}>Open the source document <span aria-hidden="true">↗</span></a>
      </div>
    );
  }

  return <article className="info-card legal-document-content" dangerouslySetInnerHTML={{ __html: html }} />;
}
