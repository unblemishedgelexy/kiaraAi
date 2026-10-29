import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { createServer } from 'vite';

const projectRoot = fileURLToPath(new URL('../', import.meta.url));
const outputRoot = path.join(projectRoot, 'dist');
const routePaths = [
  '/',
  '/features',
  '/download',
  '/about',
  '/docs',
  '/faq',
  '/privacy',
  '/terms',
  '/contact',
];

function escapeHtml(value) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('"', '&quot;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;');
}

function setMeta(html, attribute, key, value) {
  const selector = `${attribute}="${key}"`;
  const expression = new RegExp(`<meta\\b[^>]*\\b${attribute}="${key}"[^>]*>`, 'i');
  const replacement = `<meta ${selector} content="${escapeHtml(value)}" />`;
  return expression.test(html)
    ? html.replace(expression, replacement)
    : html.replace('</head>', `    ${replacement}\n  </head>`);
}

function setCanonical(html, url) {
  return html.replace(
    /<link\b(?=[^>]*\brel="canonical")[^>]*>/i,
    `<link rel="canonical" href="${escapeHtml(url)}" />`,
  );
}

function renderMetadata(html, pathName, metadata) {
  const canonicalUrl = `https://kiaraai.in${pathName}`;
  let pageHtml = html.replace(/<title>[\s\S]*?<\/title>/i, `<title>${escapeHtml(metadata.title)}</title>`);
  pageHtml = setMeta(pageHtml, 'name', 'description', metadata.description);
  pageHtml = setMeta(pageHtml, 'name', 'robots', 'index,follow,max-image-preview:large');
  pageHtml = setMeta(pageHtml, 'property', 'og:title', metadata.title);
  pageHtml = setMeta(pageHtml, 'property', 'og:description', metadata.description);
  pageHtml = setMeta(pageHtml, 'property', 'og:url', canonicalUrl);
  pageHtml = setMeta(pageHtml, 'name', 'twitter:title', metadata.title);
  pageHtml = setMeta(pageHtml, 'name', 'twitter:description', metadata.description);
  return setCanonical(pageHtml, canonicalUrl);
}

const vite = await createServer({
  appType: 'custom',
  logLevel: 'error',
  server: { middlewareMode: true, hmr: false },
});

try {
  const [{ PrerenderedPage }, { getPageMetadata }] = await Promise.all([
    vite.ssrLoadModule('/src/App.tsx'),
    vite.ssrLoadModule('/src/seo.ts'),
  ]);
  const baseHtml = await readFile(path.join(outputRoot, 'index.html'), 'utf8');

  for (const routePath of routePaths) {
    const metadata = getPageMetadata(routePath);
    const markup = renderToString(React.createElement(PrerenderedPage, { path: routePath }));
    const html = renderMetadata(
      baseHtml.replace('<div id="root"></div>', `<div id="root">${markup}</div>`),
      routePath,
      metadata,
    );
    const pagePath = routePath === '/'
      ? path.join(outputRoot, 'index.html')
      : path.join(outputRoot, routePath.slice(1), 'index.html');

    await mkdir(path.dirname(pagePath), { recursive: true });
    await writeFile(pagePath, html);
  }

  let adminHtml = baseHtml
    .replace(/<title>[\s\S]*?<\/title>/i, '<title>Admin sign in | Kiara AI</title>')
    .replace(/<link\b(?=[^>]*\brel="canonical")[^>]*>/i, '');
  adminHtml = setMeta(adminHtml, 'name', 'robots', 'noindex,nofollow');
  adminHtml = setMeta(adminHtml, 'name', 'description', 'Sign in to the Kiara AI dashboard.');
  await mkdir(path.join(outputRoot, 'admin'), { recursive: true });
  await writeFile(path.join(outputRoot, 'admin', 'index.html'), adminHtml);
} finally {
  await vite.close();
}
