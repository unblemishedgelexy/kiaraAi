import { useCallback, useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { BrowserRouter, Link, MemoryRouter, NavLink, Route, Routes, useLocation } from 'react-router-dom';
import { CommunicationSection, ConversationExample, HowItWorksSection, TrustSection, verifiedCapabilities } from './components/marketing/EditorialSections';
import { LegalDocumentContent } from './components/public/LegalDocumentContent';
import { getPageMetadata, getStructuredData } from './seo';

const API_BASE = (import.meta.env.VITE_API_BASE_URL ?? '').replace(/\/+$/, '');
const heroImage = '/images/kiara_landing.webp';
const ACCESS_TOKEN_KEY = 'kiara_admin_access_token';

type ThemeMode = 'dark' | 'light';

function getPreferredTheme(): ThemeMode {
  if (typeof window === 'undefined') return 'dark';

  try {
    const stored = localStorage.getItem('kiara-theme');
    if (stored === 'dark' || stored === 'light') return stored;
  } catch {
    // ignore storage access issues
  }

  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function applyTheme(theme: ThemeMode) {
  document.documentElement.dataset.theme = theme;
  document.documentElement.style.colorScheme = theme;
  try {
    localStorage.setItem('kiara-theme', theme);
  } catch {
    // ignore storage access issues
  }
}

function ThemeToggle() {
  const [theme, setTheme] = useState<ThemeMode>(() => getPreferredTheme());

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  return (
    <button
      type="button"
      className="theme-toggle"
      aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
      aria-pressed={theme === 'dark'}
      onClick={() => setTheme((current) => (current === 'dark' ? 'light' : 'dark'))}
    >
      <span aria-hidden="true">{theme === 'dark' ? '☀' : '☾'}</span>
      {theme === 'dark' ? 'Light' : 'Dark'}
    </button>
  );
}

function setDocumentMeta(key: string, value: string, asProperty = false) {
  const attributeName = asProperty ? 'property' : 'name';
  let element = document.head.querySelector(`meta[${attributeName}="${key}"]`);
  if (!element) {
    element = document.createElement('meta');
    element.setAttribute(attributeName, key);
    document.head.appendChild(element);
  }
  element.setAttribute('content', value);
}

function seoMeta(path: string) {
  const { title, description } = getPageMetadata(path);
  const canonicalUrl = `https://kiaraai.in${path}`;
  document.title = title;
  setDocumentMeta('description', description);
  setDocumentMeta('robots', 'index,follow,max-image-preview:large');
  const canonical = document.head.querySelector('link[rel="canonical"]') ?? document.createElement('link');
  canonical.setAttribute('rel', 'canonical');
  canonical.setAttribute('href', canonicalUrl);
  if (!canonical.parentNode) document.head.appendChild(canonical);
  setDocumentMeta('og:title', title, true);
  setDocumentMeta('og:description', description, true);
  setDocumentMeta('og:url', canonicalUrl, true);
  setDocumentMeta('og:type', 'website', true);
  setDocumentMeta('og:site_name', 'Kiara AI', true);
  setDocumentMeta('og:image', 'https://kiaraai.in/images/kiara_landing.webp', true);
  setDocumentMeta('og:image:alt', 'Kiara AI companion artwork', true);
  setDocumentMeta('twitter:card', 'summary_large_image');
  setDocumentMeta('twitter:title', title);
  setDocumentMeta('twitter:description', description);
  setDocumentMeta('twitter:image', 'https://kiaraai.in/images/kiara_landing.webp');
}

type ApkUploadProgress =
  | { stage: 'transferring'; percentage: number }
  | { stage: 'processing' };

type WebsiteContent = {
  announcement: string;
  heroEyebrow: string;
  heroTitle: string;
  heroDescription: string;
  features: string[];
  apkAvailable: boolean;
  apkDownloadUrl: string | null;
  apkOriginalName: string | null;
  apkSize: number | null;
  apkUploadedAt: string | null;
  apkMaxSizeBytes: number;
  apkStorageConfigured?: boolean;
  apkStorageProvider?: 'imagekit' | 'r2' | null;
};

type Overview = {
  role: 'admin' | 'dev';
  counts: {
    users: number;
    activeUsers: number;
    newUsersThisMonth: number;
    subscriptions: number;
    activeSubscriptions: number;
    payments: number;
    revenuePaise: number;
    feedback: number;
    openFeedback: number;
    averageRating: number | null;
  };
  health: { mongodb: boolean; redis: boolean; checkedAt: string };
};

type PageData<T> = { items: T[]; page: number; limit: number; total: number };
type User = {
  _id: string;
  firstName?: string;
  lastName?: string;
  displayName?: string;
  email: string;
  role: string;
  mode: string;
  isActive: boolean;
  emailVerified: boolean;
  lastLogin?: string;
  createdAt: string;
};
type Subscription = {
  _id: string;
  userId?: { email?: string; firstName?: string; lastName?: string };
  planId: string;
  status: string;
  amountPaise: number;
  currency: string;
  createdAt: string;
  renewalDate?: string;
};
type Feedback = {
  _id: string;
  userId?: { email?: string; firstName?: string; lastName?: string };
  subject: string;
  message: string;
  rating?: number;
  status: 'open' | 'in_progress' | 'resolved';
  createdAt: string;
};
type AppPerformance = {
  timestamp: number;
  stages: Record<string, { count: number; avg: number; min: number; max: number; p95: number }>;
};

const defaults: WebsiteContent = {
  announcement: '',
  heroEyebrow: 'YOUR AI COMPANION',
  heroTitle: 'A thoughtful companion for real conversations.',
  heroDescription: 'Meet Kiara, an Android AI companion for everyday conversations, clearer expression, and personal reflection.',
  features: ['Voice and text conversations', 'Context-aware memory', 'An expressive 3D avatar'],
  apkAvailable: false,
  apkDownloadUrl: null,
  apkOriginalName: null,
  apkSize: null,
  apkUploadedAt: null,
  apkMaxSizeBytes: 25 * 1024 * 1024,
  apkStorageConfigured: true,
};

function useWebsiteContent() {
  const [content, setContent] = useState(defaults);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');

  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    const timeoutId = window.setTimeout(() => controller.abort(), 30000);

    void request<WebsiteContent>('/site/content', { signal: controller.signal })
      .then((result) => {
        if (active) {
          setContent(result);
          setStatus('ready');
        }
      })
      .catch(() => {
        if (active) setStatus('error');
      })
      .finally(() => window.clearTimeout(timeoutId));

    return () => {
      active = false;
      window.clearTimeout(timeoutId);
      controller.abort();
    };
  }, []);

  return { content, status };
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = localStorage.getItem(ACCESS_TOKEN_KEY);
  const headers = new Headers(options.headers);
  if (token) headers.set('Authorization', `Bearer ${token}`);
  if (options.body && !(options.body instanceof FormData)) headers.set('Content-Type', 'application/json');
  const response = await fetch(`${API_BASE}/api${path}`, { ...options, headers });
  const payload = await response.json().catch(() => ({})) as {
    success?: boolean;
    message?: string;
    data?: T;
  };
  if (!response.ok || payload.success === false) {
    throw new Error(payload.message || `Request failed (${response.status}).`);
  }
  return payload.data as T;
}

function uploadRequest<T>(path: string, body: FormData, onProgress: (progress: ApkUploadProgress) => void): Promise<T> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', `${API_BASE}/api${path}`);
    const token = localStorage.getItem(ACCESS_TOKEN_KEY);
    if (token) xhr.setRequestHeader('Authorization', `Bearer ${token}`);
    xhr.upload.addEventListener('progress', (event) => {
      if (event.lengthComputable) {
        onProgress({ stage: 'transferring', percentage: Math.floor((event.loaded / event.total) * 100) });
      }
    });
    xhr.upload.addEventListener('load', () => onProgress({ stage: 'processing' }));
    xhr.addEventListener('error', () => reject(new Error('Network error while uploading the APK. Please try again.')));
    xhr.addEventListener('abort', () => reject(new Error('APK upload was cancelled.')));
    xhr.addEventListener('load', () => {
      let payload: { success?: boolean; message?: string; data?: T };
      try {
        payload = JSON.parse(xhr.responseText) as { success?: boolean; message?: string; data?: T };
      } catch {
        reject(new Error(`Upload failed with an invalid server response (${xhr.status}).`));
        return;
      }
      if (xhr.status < 200 || xhr.status >= 300 || payload.success === false) {
        reject(new Error(payload.message || `Upload failed (${xhr.status}).`));
        return;
      }
      resolve(payload.data as T);
    });
    xhr.send(body);
  });
}

function formatDate(value?: string): string {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
}

function formatMoney(paise: number, currency = 'INR'): string {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency, maximumFractionDigits: 0 }).format(paise / 100);
}

function formatBytes(size: number | null): string {
  if (!size) return '—';
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

function getApkDownloadHref(content: WebsiteContent): string | null {
  if (!content.apkDownloadUrl) return null;
  if (content.apkStorageProvider === 'r2') return content.apkDownloadUrl;
  return `${API_BASE}/api/site/apk`;
}

function Brand({ light = false }: { light?: boolean }) {
  return <Link className={`brand${light ? ' brand-light' : ''}`} to="/" aria-label="Kiara AI home">
    <img className="brand-symbol" src="/images/kiara-logo.svg" alt="" />
    <span>kiara<span className="brand-dot">.</span></span>
  </Link>;
}

function PageMeta({ path }: { path: string }) {
  useEffect(() => {
    seoMeta(path);
  }, [path]);

  return null;
}

function PublicHeader() {
  const [menuOpen, setMenuOpen] = useState(false);

  return <header className="site-header">
    <Brand />
    <div className={`site-header__actions ${menuOpen ? 'open' : ''}`}>
      <nav className="site-nav" aria-label="Main navigation">
        <NavLink className={({ isActive }) => `site-nav__link${isActive ? ' active' : ''}`} to="/" end onClick={() => setMenuOpen(false)}>Home</NavLink>
        <NavLink className={({ isActive }) => `site-nav__link${isActive ? ' active' : ''}`} to="/features" onClick={() => setMenuOpen(false)}>Features</NavLink>
        <NavLink className={({ isActive }) => `site-nav__link${isActive ? ' active' : ''}`} to="/download" onClick={() => setMenuOpen(false)}>Download</NavLink>
        <NavLink className={({ isActive }) => `site-nav__link${isActive ? ' active' : ''}`} to="/about" onClick={() => setMenuOpen(false)}>About</NavLink>
        <NavLink className={({ isActive }) => `site-nav__link${isActive ? ' active' : ''}`} to="/docs" onClick={() => setMenuOpen(false)}>Docs</NavLink>
        <NavLink className={({ isActive }) => `site-nav__link${isActive ? ' active' : ''}`} to="/faq" onClick={() => setMenuOpen(false)}>FAQ</NavLink>
      </nav>
      <div className="site-header__tools">
        <ThemeToggle />
        <Link className="nav-cta" to="/download">Get Kiara <span>↗</span></Link>
      </div>
    </div>
    <button
      type="button"
      className="mobile-menu-toggle"
      aria-label={menuOpen ? 'Close navigation menu' : 'Open navigation menu'}
      aria-expanded={menuOpen}
      onClick={() => setMenuOpen((open) => !open)}
    >
      <span />
      <span />
      <span />
    </button>
  </header>;
}

function PublicLayout({ path, children }: { path: string; children: ReactNode }) {
  const structuredData = getStructuredData(path);

  return <>
    <PageMeta path={path} />
    <main className="landing">{children}</main>
    {structuredData && <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData).replace(/</g, '\\u003c') }}
    />}
    <footer className="site-footer">
      <Brand light />
      <div className="footer-links">
        <Link to="/features">Features</Link>
        <Link to="/download">Download</Link>
        <Link to="/about">About</Link>
        <Link to="/docs">Docs</Link>
        <Link to="/faq">FAQ</Link>
        <Link to="/privacy">Privacy</Link>
        <Link to="/terms">Terms</Link>
        <Link to="/contact">Contact</Link>
      </div>
      <span>© {new Date().getFullYear()} Kiara AI.</span>
    </footer>
  </>;
}

function HomePage() {
  const { content, status } = useWebsiteContent();
  const apkDownloadHref = getApkDownloadHref(content);
  const releaseAvailable = status === 'ready' && content.apkAvailable && Boolean(apkDownloadHref);

  return <PublicLayout path="/">
    {content.announcement && <div className="announcement">{content.announcement}</div>}
    <PublicHeader />
    <p className="header-blessing">श्री गणेशाय नमः</p>

    <section className="hero" id="experience">
      <div className="hero-copy">
        <p className="eyebrow"><span className="eyebrow-line" />{content.heroEyebrow}</p>
        <h1>{content.heroTitle.split(' ').slice(0, -2).join(' ')} <em>{content.heroTitle.split(' ').slice(-2).join(' ')}</em></h1>
        <p className="hero-description">{content.heroDescription}</p>
        <p className="hero-purpose">An Android AI companion for clearer communication, everyday reflection, and personal growth.</p>
        <div className="hero-actions">
          <Link className="button button-primary" to="/download">
            {releaseAvailable ? 'Download for Android' : 'Check Android availability'} <span>↗</span>
          </Link>
          <Link className="button button-quiet" to="/about">Why Kiara exists <span aria-hidden="true">↗</span></Link>
        </div>
        {status === 'error' && <p className="inline-error" role="status">Release availability could not be checked. The download page will show the current status when it is available.</p>}
        <div className="hero-note">Text or live voice <span className="note-divider" aria-hidden="true" /> Android companion</div>
      </div>
      <div className="hero-art">
        <div className="art-glow" />
        <div className="art-frame">
          <img src={heroImage} alt="Kiara AI companion illustration" />
          <div className="image-caption"><span className="caption-spark">✦</span><span><strong>Meet Kiara</strong><small>Your thoughtful AI companion</small></span><span className="caption-arrow">↗</span></div>
        </div>
      </div>
    </section>

    <section className="intro-strip" id="about">
      <div className="intro-mark">K.</div>
      <p>Technology for human connection.<br /><strong>Not a replacement for it.</strong></p>
      <span className="intro-caption">A companion to support your real life.</span>
    </section>

    <CommunicationSection />

    <section className="feature-section" id="features">
      <div className="section-heading">
        <div><p className="eyebrow"><span className="eyebrow-line" /> WHAT THE APP INCLUDES</p><h2>A familiar way<br /><em>to talk things through.</em></h2></div>
        <p className="section-description">The Android app includes text and live voice conversation, context memory, and a 3D companion avatar. Feature availability can depend on connection, permissions, and service configuration.</p>
      </div>
      <div className="feature-grid">
        {content.features.map((feature, index) => <article className={`feature-card feature-${index + 1}`} key={feature}>
          <span className="feature-number">0{index + 1}</span><span className="feature-symbol">{['◉', '✧', '◌'][index] || '✦'}</span>
          <h3>{feature}</h3>
          <p>{[
            'Choose typed messages or a live voice conversation in the Android app.',
            'The app includes local and server-backed memory code for relevant context.',
            'The Android experience renders an animated 3D avatar during conversation.',
          ][index]}</p>
          <Link className="feature-link" to="/features">How it works <b aria-hidden="true">↗</b></Link>
        </article>)}
      </div>
    </section>

    <HowItWorksSection />
    <ConversationExample />
    <TrustSection />

    <section className="download-banner">
      <div><p className="eyebrow"><span className="eyebrow-line" /> ANDROID APP</p><h2>Take the conversation<br /><em>with you.</em></h2></div>
      <div className="download-action">
        <p>Check whether an Android release is currently published, then review the install steps and product limits.</p>
        <Link className="button button-primary" to="/download">{releaseAvailable ? 'View the Android release' : 'Check release availability'} <span aria-hidden="true">↗</span></Link>
        {releaseAvailable && <small className="apk-caption">{content.apkOriginalName} · {formatBytes(content.apkSize)}</small>}
      </div>
    </section>
  </PublicLayout>;
}

function FeaturesPage() {
  return <PublicLayout path="/features">
    <PublicHeader />
    <section className="page-shell">
      <div className="page-header">
        <p className="eyebrow"><span className="eyebrow-line" /> WHAT IS IN THE ANDROID APP</p>
        <h1>Useful tools for an honest conversation.</h1>
        <p className="page-lead">These capabilities have corresponding code paths in the available Android app and server projects. Their runtime availability still depends on permissions, network access, and configured services.</p>
      </div>
      <div className="content-grid two-up">
        {verifiedCapabilities.map((capability) => <article className="info-card capability-card" key={capability.title}>
          <span className="feature-symbol" aria-hidden="true">{capability.symbol}</span>
          <h2>{capability.title}</h2>
          <p>{capability.description}</p>
          <p className="capability-example"><strong>For example:</strong> {capability.example}</p>
        </article>)}
      </div>
      <div className="product-note">
        <h2>What Kiara does not claim</h2>
        <p>Photo sharing is an optional way to add context. It is not a reliable system for reading body language, diagnosing emotions, or knowing what another person truly thinks. Kiara is also not a therapist or a substitute for professional care.</p>
        <Link className="inline-link" to="/docs">Read the getting-started guide <span aria-hidden="true">↗</span></Link>
      </div>
    </section>
  </PublicLayout>;
}

function DownloadPage() {
  const { content, status } = useWebsiteContent();
  const apkDownloadHref = getApkDownloadHref(content);

  return <PublicLayout path="/download">
    <PublicHeader />
    <section className="page-shell">
      <div className="page-header narrow">
        <p className="eyebrow"><span className="eyebrow-line" /> DOWNLOAD</p>
        <h1>Check the Android release.</h1>
        <p className="page-lead">Kiara's available client in this workspace is an Android app. This page checks the public release service before showing a download action.</p>
      </div>
      <div className="download-panel">
        <div>
          <p className="mini-label">Release status</p>
          <h2>{status === 'loading' ? 'Checking availability…' : status === 'error' ? 'Status unavailable' : content.apkAvailable && apkDownloadHref ? 'Android release available' : 'No release published'}</h2>
          <p>
            {status === 'loading' && 'Checking the current public release record. No download link will appear until the release service confirms one.'}
            {status === 'error' && 'We could not verify the release right now. Please try again later; we will not show an unverified download link.'}
            {status === 'ready' && content.apkAvailable && apkDownloadHref && 'The release service reports a published Android package. Review the install steps and Android version before downloading.'}
            {status === 'ready' && (!content.apkAvailable || !apkDownloadHref) && 'There is no Android package available from the release service right now. Please check back later.'}
          </p>
        </div>
        {status === 'ready' && content.apkAvailable && apkDownloadHref && <div className="download-cta-box">
          <strong>{content.apkOriginalName || 'Kiara Android APK'}</strong>
          <p>{formatBytes(content.apkSize)}{content.apkUploadedAt ? ` · Published ${formatDate(content.apkUploadedAt)}` : ''}</p>
          <a className="button button-primary" href={apkDownloadHref}>Download the published APK <span aria-hidden="true">↗</span></a>
        </div>}
      </div>
      <div className="content-grid two-up">
        <article className="info-card"><h2>Minimum Android version</h2><p>The app build sets Android API 24 as its minimum (Android 7.0). This is the configured software minimum, not a guarantee of performance on every device.</p></article>
        <article className="info-card"><h2>Install the APK</h2><ol className="check-list"><li>Download only from the release link shown above.</li><li>Open the downloaded APK and follow Android's prompts. Android may ask you to allow installs from the app you used to download it.</li><li>Open Kiara, create or sign in to an account, and grant microphone or camera access only when you choose a feature that needs it.</li></ol></article>
        <article className="info-card"><h2>Before you install</h2><p>The app requires an internet connection for account and AI services. Review the <Link className="inline-link" to="/privacy">privacy draft</Link> and <Link className="inline-link" to="/terms">terms draft</Link> first; both contain items that still need confirmation.</p></article>
        <article className="info-card"><h2>Release details</h2><p>The website publishing flow exposes the APK name, size, and upload date, but does not publish release notes, a checksum, or signature-verification instructions. A Windows desktop download or app-store listing was not verified.</p></article>
      </div>
    </section>
  </PublicLayout>;
}

function AboutPage() {
  return <PublicLayout path="/about">
    <PublicHeader />
    <section className="page-shell">
      <div className="page-header narrow">
        <p className="eyebrow"><span className="eyebrow-line" /> WHY KIARA EXISTS</p>
        <h1>More understanding.<br /><em>More human connection.</em></h1>
        <p className="page-lead">Kiara is an AI companion for people who want space to talk, find their words, and reflect on everyday life - without being talked down to.</p>
      </div>
      <div className="content-grid two-up">
        <article className="info-card"><h2>Communication, not a lecture</h2><p>The goal is a warm, natural conversation that can help you consider what you want to say, understand how a moment felt to you, and decide what fits your values.</p></article>
        <article className="info-card"><h2>Growth on your terms</h2><p>Kiara can be a place to reflect on confidence, habits, or personal goals. It should support your own judgment and relationships, never replace them or encourage dependence.</p></article>
        <article className="info-card"><h2>What exists today</h2><p>The available client project builds an Android app with text and live voice conversation, context-memory code, an animated 3D avatar, and optional photo/file context flows.</p></article>
        <article className="info-card"><h2>What remains unverified</h2><p>Dedicated communication coaching, reliable body-language interpretation, mood diagnosis, and a Windows desktop product are not verified as complete user-facing features. We do not advertise them as available.</p></article>
      </div>
      <p className="product-note">Kiara is an AI companion, not a mental-health professional or emergency service. AI responses can be wrong or miss important context.</p>
    </section>
  </PublicLayout>;
}

function DocsPage() {
  return <PublicLayout path="/docs">
    <PublicHeader />
    <section className="page-shell">
      <div className="page-header narrow">
        <p className="eyebrow"><span className="eyebrow-line" /> GETTING STARTED</p>
        <h1>Your first conversation, step by step.</h1>
        <p className="page-lead">The app project targets Android 7.0 (API 24) and later. Download availability is checked separately, so start at the release page.</p>
      </div>
      <div className="content-grid three-up">
        <article className="info-card"><span className="feature-number">01 / INSTALL</span><h2>Get the current release</h2><p>Check the release status first. If an APK is published, download it from the official link and follow the Android installation prompts.</p><Link className="inline-link" to="/download">Check Android availability <span aria-hidden="true">↗</span></Link></article>
        <article className="info-card"><span className="feature-number">02 / SIGN IN</span><h2>Create or access your account</h2><p>The app contains regular-user sign-in and registration flows. This website's separate admin sign-in is not for normal Kiara accounts.</p></article>
        <article className="info-card"><span className="feature-number">03 / TALK</span><h2>Choose text or voice</h2><p>Start by typing. For live voice, allow microphone access when Android asks. You can continue with follow-up messages in the conversation.</p></article>
        <article className="info-card"><span className="feature-number">04 / SHARE</span><h2>Add optional context</h2><p>The app includes camera-photo and file-attachment flows. Choose what to share; do not include another person's sensitive information without permission.</p></article>
        <article className="info-card"><span className="feature-number">05 / MANAGE</span><h2>Review memory and account controls</h2><p>Settings in the app include memory-wipe and account-deletion request flows. Review the current privacy draft to understand the unresolved retention and provider questions.</p><Link className="inline-link" to="/privacy">Read privacy draft <span aria-hidden="true">↗</span></Link></article>
        <article className="info-card"><span className="feature-number">06 / REMEMBER</span><h2>Keep your own judgment</h2><p>Kiara can misunderstand a situation. Use its responses as a perspective to consider, not a verdict about you or another person.</p></article>
      </div>
    </section>
  </PublicLayout>;
}

function FaqPage() {
  return <PublicLayout path="/faq">
    <PublicHeader />
    <section className="page-shell faq-shell">
      <div className="page-header narrow">
        <p className="eyebrow"><span className="eyebrow-line" /> FAQ</p>
        <h1>Clear answers before you begin.</h1>
      </div>
      <div className="faq-list">
        <details className="info-card faq-item"><summary>What is Kiara?</summary><p>Kiara is an Android AI companion intended to support everyday conversation, clearer self-expression, and personal reflection. The product goal is to feel like a thoughtful friend, not a lecturer.</p></details>
        <details className="info-card faq-item"><summary>What can the app do today?</summary><p>The codebase includes typed and live voice conversation, memory systems, a 3D animated avatar, and optional photo/file attachment paths. Actual service availability can depend on connection, permissions, and backend configuration.</p></details>
        <details className="info-card faq-item"><summary>Which platforms are supported?</summary><p>The available app project is an Android Capacitor app with Android API 24 (Android 7.0) configured as its minimum. No complete Windows desktop release was verified in the available app project.</p></details>
        <details className="info-card faq-item"><summary>Can Kiara read body language or tell what someone feels?</summary><p>No such reliable capability is verified. The app can let you add a photo as context, but do not use Kiara as a way to infer someone's thoughts, diagnose a mood, or establish their intentions.</p></details>
        <details className="info-card faq-item"><summary>Is Kiara a therapist or mental-health service?</summary><p>No. Kiara can be used to talk through everyday situations, but it is not professional mental-health care, medical advice, or an emergency service. AI can be inaccurate or miss context.</p></details>
        <details className="info-card faq-item"><summary>How does Kiara handle my information?</summary><p>The supplied Privacy Policy is a draft and explicitly leaves AI providers, storage locations, retention periods, and security details for confirmation. Read the full draft before sharing sensitive information; do not treat it as an approved final policy.</p><Link className="inline-link" to="/privacy">Read the full privacy draft <span aria-hidden="true">↗</span></Link></details>
        <details className="info-card faq-item"><summary>Can I delete memory or request account deletion?</summary><p>The Android app includes settings flows to wipe saved memory and request account deletion. The separate public deletion document is also marked as a draft and says the operational process needs confirmation.</p></details>
        <details className="info-card faq-item"><summary>Is an APK available now?</summary><p>Availability is checked against the public release service on the <Link className="inline-link" to="/download">download page</Link>. If the check fails or no package is published, the site will not show a download button.</p></details>
        <details className="info-card faq-item"><summary>Where can I get help?</summary><p>The legal drafts list <a href="mailto:unblemishedgelexy@gmail.com">unblemishedgelexy@gmail.com</a>, but mailbox monitoring and support availability have not been independently verified. Do not send passwords, verification codes, or unnecessary sensitive information.</p></details>
        <details className="info-card faq-item"><summary>Who can use Kiara?</summary><p>The supplied Terms draft says Kiara is intended for people aged 18 or older. The draft itself still requires publication review.</p><Link className="inline-link" to="/terms">Read the full terms draft <span aria-hidden="true">↗</span></Link></details>
      </div>
    </section>
  </PublicLayout>;
}

function PolicyPage() {
  return <PublicLayout path="/privacy">
    <PublicHeader />
    <section className="page-shell legal-shell">
      <div className="page-header narrow">
        <p className="eyebrow"><span className="eyebrow-line" /> SOURCE DOCUMENT / REVIEW REQUIRED</p>
        <h1>Privacy Policy draft.</h1>
        <p className="page-lead">This is the full document supplied with the Android app. It is reproduced without rewriting; the source itself marks provider, storage, retention, and safeguards for confirmation.</p>
      </div>
      <LegalDocumentContent documentName="privacy" />
      <p className="legal-source-link">Source document: <a href="/legal/privacy.html">open the original HTML</a>.</p>
    </section>
  </PublicLayout>;
}

function TermsPage() {
  return <PublicLayout path="/terms">
    <PublicHeader />
    <section className="page-shell legal-shell">
      <div className="page-header narrow">
        <p className="eyebrow"><span className="eyebrow-line" /> SOURCE DOCUMENT / REVIEW REQUIRED</p>
        <h1>Terms &amp; Conditions draft.</h1>
        <p className="page-lead">This is the full document supplied with the Android app. It is reproduced without rewriting; the source itself calls for legal and product review.</p>
      </div>
      <LegalDocumentContent documentName="terms" />
      <p className="legal-source-link">Source document: <a href="/legal/terms.html">open the original HTML</a>.</p>
    </section>
  </PublicLayout>;
}

function ContactPage() {
  return <PublicLayout path="/contact">
    <PublicHeader />
    <section className="page-shell legal-shell">
      <div className="page-header narrow">
        <p className="eyebrow"><span className="eyebrow-line" /> CONTACT</p>
        <h1>Contact and support.</h1>
      </div>
      <div className="info-card legal-card">
        <p>The supplied Privacy Policy and Terms drafts list <a href="mailto:unblemishedgelexy@gmail.com">unblemishedgelexy@gmail.com</a> for questions. The documents also say the responsible contact and request-handling process still need confirmation, so mailbox monitoring and response times are not verified here.</p>
        <p>Please do not email passwords, sign-in codes, or unnecessary sensitive information. For product basics, see the <Link to="/docs">getting-started guide</Link>, <Link to="/faq">FAQ</Link>, and the full <Link to="/privacy">privacy draft</Link>.</p>
      </div>
    </section>
  </PublicLayout>;
}

type AdminSection = 'overview' | 'users' | 'subscriptions' | 'feedback' | 'helpdesk' | 'performance' | 'content';

function AdminLogin({ onLogin, initialError, darkMode, onToggleTheme }: {
  onLogin: (email: string, password: string) => Promise<void>;
  initialError: string;
  darkMode: boolean;
  onToggleTheme: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(initialError);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => setError(initialError), [initialError]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      await onLogin(email, password);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Sign-in failed.');
    } finally {
      setBusy(false);
    }
  }

  return <main className="login-screen" data-theme={darkMode ? 'dark' : 'light'}>
    <div className="login-art">
      <img className="login-art-image" src="/images/admin-login.webp" alt="Kiara at her desk" />
      <div className="login-art-tint" />
      <Brand light />
      <p>Every meaningful connection<br />starts with a hello.</p>
      <span>KIARA ADMINISTRATION</span>
    </div>
    <form className="login-form" onSubmit={submit}>
      <button className="theme-toggle login-theme-toggle" type="button" onClick={onToggleTheme} aria-pressed={darkMode}>
        <span aria-hidden="true">{darkMode ? '☀' : '☾'}</span>{darkMode ? 'Light mode' : 'Dark mode'}
      </button>
      <a className="back-link" href="/">← Back to Kiara</a><div className="login-form-content"><p className="eyebrow"><span className="eyebrow-line" /> SECURE ADMIN ACCESS</p><h1>Welcome<br /><em>back.</em></h1><p className="login-copy">Sign in with the email and password provisioned for your admin account.</p>
        {error && <p className="form-error">{error}</p>}
        <label className="login-field">Admin email
          <input type="email" name="email" autoComplete="username" required value={email} onChange={(event) => setEmail(event.target.value)} />
        </label>
        <label className="login-field">Password
          <span className="password-input-wrap">
            <input type={showPassword ? 'text' : 'password'} name="password" autoComplete="current-password" required value={password} onChange={(event) => setPassword(event.target.value)} />
            <button
              className="password-visibility-toggle"
              type="button"
              onClick={() => setShowPassword((visible) => !visible)}
              aria-label={showPassword ? 'Hide password' : 'Show password'}
              aria-pressed={showPassword}
            >
              {showPassword ? 'Hide' : 'Show'}
            </button>
          </span>
        </label>
        <button className="button button-primary login-submit" disabled={busy}>{busy ? 'Signing in…' : 'Sign in to admin'}</button>
        <p className="secure-note">Admin accounts are created by the system administrator through a private provisioning request. If you need access, contact the Kiara administrator. Regular user accounts cannot access this panel.</p>
      </div>
    </form>
  </main>;
}

function MetricCard({ label, value, note, icon }: { label: string; value: string; note: string; icon: string }) {
  return <article className="metric-card"><span className="metric-icon">{icon}</span><span className="metric-label">{label}</span><strong>{value}</strong><small>{note}</small></article>;
}

function AdminApp() {
  const [darkMode, setDarkMode] = useState(() => {
    const storedTheme = localStorage.getItem('kiara-theme') ?? localStorage.getItem('kiara_admin_theme');
    return storedTheme === 'dark' || (storedTheme !== 'light' && getPreferredTheme() === 'dark');
  });
  const [authenticated, setAuthenticated] = useState(Boolean(localStorage.getItem(ACCESS_TOKEN_KEY)));
  const [role, setRole] = useState<'admin' | 'dev' | null>(null);
  const [section, setSection] = useState<AdminSection>('overview');
  const [overview, setOverview] = useState<Overview | null>(null);
  const [users, setUsers] = useState<PageData<User> | null>(null);
  const [subscriptions, setSubscriptions] = useState<PageData<Subscription> | null>(null);
  const [feedback, setFeedback] = useState<PageData<Feedback> | null>(null);
  const [helpdesk, setHelpdesk] = useState<PageData<Feedback> | null>(null);
  const [performance, setPerformance] = useState<AppPerformance | null>(null);
  const [content, setContent] = useState(defaults);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [deletingApk, setDeletingApk] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<ApkUploadProgress | null>(null);

  function toggleTheme() {
    setDarkMode((current) => {
      const next = !current;
      applyTheme(next ? 'dark' : 'light');
      return next;
    });
  }

  const load = useCallback(async () => {
    if (!authenticated) return;
    setBusy(true);
    setError('');
    try {
      if (section === 'overview') {
        const result = await request<Overview>('/admin/overview');
        setOverview(result);
        setRole(result.role);
      }
      if (section === 'users') setUsers(await request<PageData<User>>(`/admin/users?page=${page}&limit=20&q=${encodeURIComponent(search)}`));
      if (section === 'subscriptions') setSubscriptions(await request<PageData<Subscription>>(`/admin/subscriptions?page=${page}&limit=20&q=${encodeURIComponent(search)}`));
      if (section === 'feedback') setFeedback(await request<PageData<Feedback>>(`/admin/feedback?page=${page}&limit=20`));
      if (section === 'helpdesk') setHelpdesk(await request<PageData<Feedback>>(`/admin/helpdesk?page=${page}&limit=20`));
      if (section === 'performance') setPerformance(await request<AppPerformance>('/admin/app-performance'));
      if (section === 'content') setContent(await request<WebsiteContent>('/admin/content'));
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : 'Could not load admin data.';
      setError(message);
      if (
        message.toLowerCase().includes('administrator or developer access required')
        || message.toLowerCase().includes('admin access token')
        || message.toLowerCase().includes('admin authentication required')
        || message.toLowerCase().includes('invalid or expired admin token')
        || message.includes('Invalid or expired token')
      ) {
        localStorage.removeItem(ACCESS_TOKEN_KEY);
        setRole(null);
        setAuthenticated(false);
      }
    } finally {
      setBusy(false);
    }
  }, [authenticated, page, search, section]);

  useEffect(() => { void load(); }, [load]);

  async function loginWithPassword(email: string, password: string) {
    const session = await request<{
      accessToken: string;
      user: { role: string };
    }>('/admin/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    if (!session.accessToken) {
      throw new Error('The server returned an invalid admin session.');
    }

    localStorage.setItem(ACCESS_TOKEN_KEY, session.accessToken);
    try {
      const adminOverview = await request<Overview>('/admin/overview');
      if (!['admin', 'dev'].includes(adminOverview.role)) {
        throw new Error('This account does not have admin-panel access.');
      }
      setOverview(adminOverview);
      setRole(adminOverview.role);
      setAuthenticated(true);
      setSection('overview');
    } catch (cause) {
      localStorage.removeItem(ACCESS_TOKEN_KEY);
      throw cause;
    }
  }

  async function saveContent(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setNotice('');
    try {
      const updated = await request<WebsiteContent>('/admin/content', {
        method: 'PATCH',
        body: JSON.stringify(content),
      });
      setContent(updated);
      setNotice('Website content saved.');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not save website content.');
    }
  }

  async function uploadApk(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (content.apkStorageConfigured === false) {
      setError('ImageKit is not configured on the server. Add IMAGEKIT_PUBLIC_KEY, IMAGEKIT_PRIVATE_KEY, and IMAGEKIT_URL_ENDPOINT, then restart the server.');
      return;
    }
    const form = event.currentTarget;
    const file = new FormData(form).get('apk');
    if (!(file instanceof File) || file.size === 0) {
      setError('Choose an APK file before uploading.');
      return;
    }
    if (file.size > content.apkMaxSizeBytes) {
      setError(`This APK exceeds the server upload limit of ${formatBytes(content.apkMaxSizeBytes)}.`);
      return;
    }
    setError('');
    setNotice('');
    setBusy(true);
    setUploadProgress({ stage: 'transferring', percentage: 0 });
    try {
      const updated = await uploadRequest<WebsiteContent>(
        '/admin/content/apk',
        formDataForApk(file),
        setUploadProgress,
      );
      setContent(updated);
      setNotice('APK uploaded to ImageKit and published for download.');
      form.reset();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not upload the model.');
    } finally {
      setBusy(false);
      setUploadProgress(null);
    }
  }

  async function deleteApk() {
    if (!window.confirm('Delete the published APK from ImageKit and remove it from the website?')) return;
    setError('');
    setNotice('');
    setDeletingApk(true);
    try {
      const updated = await request<WebsiteContent>('/admin/content/apk', { method: 'DELETE' });
      setContent(updated);
      setNotice('Published APK deleted and removed from the website.');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not delete the published APK.');
    } finally {
      setDeletingApk(false);
    }
  }

  async function changeUserStatus(user: User) {
    setError('');
    try {
      await request(`/admin/users/${user._id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ isActive: !user.isActive }),
      });
      setUsers((current) => current && ({
        ...current,
        items: current.items.map((item) => item._id === user._id ? { ...item, isActive: !item.isActive } : item),
      }));
      setNotice(`Account ${user.isActive ? 'deactivated' : 'reactivated'}.`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not update user.');
    }
  }

  async function changeSupportStatus(item: Feedback, status: Feedback['status']) {
    setError('');
    try {
      await request(`/admin/feedback/${item._id}/status`, { method: 'PATCH', body: JSON.stringify({ status }) });
      setFeedback((current) => current && ({ ...current, items: current.items.map((row) => row._id === item._id ? { ...row, status } : row) }));
      setHelpdesk((current) => current && ({ ...current, items: current.items.map((row) => row._id === item._id ? { ...row, status } : row) }));
      setNotice('Support status updated.');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not update feedback.');
    }
  }

  function signOut() {
    localStorage.removeItem(ACCESS_TOKEN_KEY);
    setAuthenticated(false);
    setOverview(null);
    setRole(null);
  }

  if (authenticated && !role) {
    return <main className="login-check" role="status">Checking admin access…</main>;
  }
  if (!authenticated) return <AdminLogin onLogin={loginWithPassword} initialError={error} darkMode={darkMode} onToggleTheme={toggleTheme} />;

  const sections: { id: AdminSection; label: string; icon: string }[] = [
    { id: 'overview', label: 'Overview', icon: '◫' },
    { id: 'users', label: 'Users', icon: '♙' },
    { id: 'subscriptions', label: 'Subscriptions', icon: '◇' },
    { id: 'feedback', label: 'Feedback', icon: '✧' },
    { id: 'helpdesk', label: 'Help desk', icon: '✉' },
    { id: 'performance', label: 'App performance', icon: '⌁' },
    { id: 'content', label: 'Website & APK', icon: '⇧' },
  ];

  return <main className="admin-layout" data-theme={darkMode ? 'dark' : 'light'}>
    <aside className="admin-sidebar"><div className="sidebar-brand"><Brand light /><span>CONTROL ROOM</span></div>
      <div className="sidebar-label">WORKSPACE</div><nav>{sections.map((item) => <button className={`side-link${section === item.id ? ' active' : ''}`} key={item.id} onClick={() => { setSection(item.id); setPage(1); setSearch(''); setError(''); setNotice(''); }}><span>{item.icon}</span>{item.label}{item.id === 'feedback' && overview?.counts.openFeedback ? <b>{overview.counts.openFeedback}</b> : null}</button>)}</nav>
      <div className="sidebar-bottom"><a href="/" className="side-link"><span>↗</span> View website</a><button className="side-link" onClick={signOut}><span>⇥</span> Sign out</button><div className="admin-profile"><span className="admin-avatar">K</span><span><strong>{role === 'dev' ? 'Developer' : 'Administrator'}</strong><small>{role === 'dev' ? 'Developer access' : 'Kiara control room'}</small></span><i>●</i></div></div>
    </aside>
    <section className="admin-main">
      <header className="admin-topbar"><div><span className="breadcrumb">KIARA / {role === 'dev' ? 'DEVELOPER' : 'ADMIN'}</span><h1>{sections.find((item) => item.id === section)?.label}</h1></div><div className="topbar-actions"><span className="live-status"><i /> System live</span><button className="theme-toggle" type="button" onClick={toggleTheme} aria-pressed={darkMode}><span aria-hidden="true">{darkMode ? '☀' : '☾'}</span>{darkMode ? 'Light mode' : 'Dark mode'}</button><button className="icon-button" onClick={() => void load()} aria-label="Refresh data">↻</button><span className="top-avatar">K</span></div></header>
      <div className="admin-content">
        {error && <div className="notice notice-error">{error}<button onClick={() => setError('')} aria-label="Dismiss">×</button></div>}
        {notice && <div className="notice notice-success">{notice}<button onClick={() => setNotice('')} aria-label="Dismiss">×</button></div>}
        {busy && <div className="loading-line">Syncing with Kiara server…</div>}
        {section === 'overview' && overview && <OverviewView data={overview} onSelect={setSection} />}
        {section === 'users' && <UsersView data={users} search={search} setSearch={(value) => { setSearch(value); setPage(1); }} onToggle={changeUserStatus} page={page} setPage={setPage} canManage={role === 'admin'} />}
        {section === 'subscriptions' && <SubscriptionsView data={subscriptions} search={search} setSearch={(value) => { setSearch(value); setPage(1); }} page={page} setPage={setPage} />}
        {section === 'feedback' && <FeedbackView data={feedback} onStatus={changeSupportStatus} page={page} setPage={setPage} />}
        {section === 'helpdesk' && <HelpdeskView data={helpdesk} onStatus={changeSupportStatus} page={page} setPage={setPage} />}
        {section === 'performance' && <PerformanceView data={performance} />}
        {section === 'content' && <ContentView content={content} setContent={setContent} onSave={saveContent} onUpload={uploadApk} onDelete={deleteApk} busy={busy} deletingApk={deletingApk} uploadProgress={uploadProgress} canEdit={role === 'admin'} />}
      </div>
    </section>
  </main>;
}

function OverviewView({ data, onSelect }: { data: Overview; onSelect: (section: AdminSection) => void }) {
  const count = data.counts;
  return <>
    <div className="welcome-row"><div><p className="eyebrow"><span className="eyebrow-line" /> YOUR KIARA AT A GLANCE</p><h2>Good to have you here.</h2><p>Here’s what’s happening across your Kiara experience.</p></div><span className="date-pill">✦ &nbsp; {new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}</span></div>
    <div className="metric-grid">
      <MetricCard label="Total users" value={count.users.toLocaleString()} note={`+${count.newUsersThisMonth} in the last 30 days`} icon="♙" />
      <MetricCard label="Active subscriptions" value={count.activeSubscriptions.toLocaleString()} note={`${count.subscriptions.toLocaleString()} subscriptions total`} icon="◇" />
      <MetricCard label="Captured revenue" value={formatMoney(count.revenuePaise)} note={`${count.payments.toLocaleString()} successful payments`} icon="₹" />
      <MetricCard label="Open feedback" value={count.openFeedback.toLocaleString()} note={`${count.feedback.toLocaleString()} feedback entries`} icon="✧" />
    </div>
    <div className="overview-columns"><section className="panel health-panel"><div className="panel-heading"><div><h3>Platform health</h3><p>Live connection status from kiara-server</p></div><span className="live-status"><i /> Updated just now</span></div>
      <div className="health-list">{[['API server', true], ['MongoDB', data.health.mongodb], ['Redis', data.health.redis]].map(([name, active]) => <div className="health-row" key={String(name)}><span className="health-icon">{name === 'MongoDB' ? '◉' : name === 'Redis' ? '◈' : '⌘'}</span><strong>{name}</strong><span className={`health-badge ${active ? 'healthy' : 'unavailable'}`}><i />{active ? 'Operational' : 'Unavailable'}</span></div>)}</div>
      <p className="health-footnote">Last checked {formatDate(data.health.checkedAt)}</p>
    </section><section className="panel quick-panel"><div className="panel-heading"><div><h3>Quick actions</h3><p>Pick up where you left off</p></div></div>
        <button className="quick-action" onClick={() => onSelect('feedback')}><span className="quick-icon pink">✧</span><span><strong>Review user feedback</strong><small>{count.openFeedback} open items need attention</small></span><b>→</b></button>
        <button className="quick-action" onClick={() => onSelect('performance')}><span className="quick-icon blue">⌁</span><span><strong>Check app performance</strong><small>Review collected client stage timings</small></span><b>→</b></button>
        <button className="quick-action" onClick={() => onSelect('helpdesk')}><span className="quick-icon pink">✉</span><span><strong>Open help desk</strong><small>Manage support requests</small></span><b>→</b></button>
        <button className="quick-action" onClick={() => onSelect('content')}><span className="quick-icon blue">⇧</span><span><strong>Publish an Android APK</strong><small>Upload a release to ImageKit</small></span><b>→</b></button>
        <button className="quick-action" onClick={() => onSelect('users')}><span className="quick-icon violet">♙</span><span><strong>Explore your community</strong><small>{count.activeUsers} active accounts</small></span><b>→</b></button>
      </section></div>
    <p className="data-footnote">Revenue is calculated from captured Razorpay payments. Health values reflect the latest backend status snapshot.</p>
  </>;
}

function TableToolbar({ search, setSearch, placeholder }: { search: string; setSearch: (value: string) => void; placeholder: string }) {
  return <div className="table-toolbar"><label className="search-box"><span>⌕</span><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder={placeholder} /></label><button className="outline-button" onClick={() => setSearch('')}>Clear filters</button></div>;
}

function Pagination({ data, page, setPage }: { data: PageData<unknown> | null; page: number; setPage: (page: number) => void }) {
  const pageCount = Math.max(1, Math.ceil((data?.total ?? 0) / (data?.limit ?? 20)));
  return <div className="pagination"><span>{data?.total ? `${(page - 1) * (data?.limit ?? 20) + 1}–${Math.min(page * (data?.limit ?? 20), data.total)} of ${data.total}` : '0 results'}</span><div><button disabled={page <= 1} onClick={() => setPage(page - 1)}>Previous</button><strong>{page} / {pageCount}</strong><button disabled={page >= pageCount} onClick={() => setPage(page + 1)}>Next</button></div></div>;
}

function UsersView({ data, search, setSearch, onToggle, page, setPage, canManage }: { data: PageData<User> | null; search: string; setSearch: (value: string) => void; onToggle: (user: User) => void; page: number; setPage: (page: number) => void; canManage: boolean }) {
  return <section className="panel table-panel"><div className="panel-heading"><div><h3>People who make Kiara</h3><p>Review account details and access status.</p></div><span className="count-pill">{data?.total ?? 0} accounts</span></div><TableToolbar search={search} setSearch={setSearch} placeholder="Search by name or email" />
    <div className="table-scroll"><table><thead><tr><th>MEMBER</th><th>ROLE</th><th>JOINED</th><th>LAST SEEN</th><th>STATUS</th>{canManage && <th>ACTION</th>}</tr></thead><tbody>{data?.items.map((user) => <tr key={user._id}><td><div className="member-cell"><span className="member-avatar">{(user.firstName || user.email)[0].toUpperCase()}</span><span><strong>{user.displayName || [user.firstName, user.lastName].filter(Boolean).join(' ') || 'Kiara member'}</strong><small>{user.email}</small></span></div></td><td><span className="role-pill">{user.role}</span></td><td>{formatDate(user.createdAt)}</td><td>{formatDate(user.lastLogin)}</td><td><span className={`status-pill ${user.isActive ? 'status-active' : 'status-inactive'}`}><i />{user.isActive ? 'Active' : 'Inactive'}</span></td>{canManage && <td><button className="text-action" onClick={() => onToggle(user)}>{user.isActive ? 'Deactivate' : 'Reactivate'}</button></td>}</tr>)}</tbody></table>{!data?.items.length && <EmptyState title="No members found" detail="Try a different name or email." />}<Pagination data={data} page={page} setPage={setPage} /></div>
  </section>;
}

function SubscriptionsView({ data, search, setSearch, page, setPage }: { data: PageData<Subscription> | null; search: string; setSearch: (value: string) => void; page: number; setPage: (page: number) => void }) {
  return <section className="panel table-panel"><div className="panel-heading"><div><h3>Subscription activity</h3><p>Plan and billing records from Kiara’s payment service.</p></div><span className="count-pill">{data?.total ?? 0} records</span></div><TableToolbar search={search} setSearch={setSearch} placeholder="Search by member email" />
    <div className="table-scroll"><table><thead><tr><th>MEMBER</th><th>PLAN</th><th>AMOUNT</th><th>STATUS</th><th>STARTED</th><th>RENEWAL</th></tr></thead><tbody>{data?.items.map((item) => <tr key={item._id}><td>{item.userId?.email || 'Unknown member'}</td><td><span className="plan-pill">{item.planId}</span></td><td>{formatMoney(item.amountPaise, item.currency)}</td><td><span className={`status-pill ${item.status === 'active' ? 'status-active' : 'status-inactive'}`}><i />{item.status.replaceAll('_', ' ')}</span></td><td>{formatDate(item.createdAt)}</td><td>{formatDate(item.renewalDate)}</td></tr>)}</tbody></table>{!data?.items.length && <EmptyState title="No subscriptions yet" detail="Subscription records will appear here." />}<Pagination data={data} page={page} setPage={setPage} /></div>
  </section>;
}

function FeedbackView({ data, onStatus, page, setPage }: { data: PageData<Feedback> | null; onStatus: (item: Feedback, status: Feedback['status']) => void; page: number; setPage: (page: number) => void }) {
  return <section className="feedback-view"><div className="panel-heading"><div><h3>Words from your community</h3><p>Read session feedback and update its status.</p></div><span className="count-pill">{data?.total ?? 0} entries</span></div>
    {!data?.items.length ? <div className="panel"><EmptyState title="No feedback yet" detail="New user feedback will show up here." /></div> : <><div className="feedback-grid">{data.items.map((item) => <article className="feedback-card" key={item._id}><div className="feedback-top"><span className="feedback-rating">{item.rating ? `${'★'.repeat(item.rating)}${'☆'.repeat(5 - item.rating)}` : 'SESSION FEEDBACK'}</span><select aria-label="Feedback status" value={item.status} onChange={(event) => onStatus(item, event.target.value as Feedback['status'])}><option value="open">Open</option><option value="in_progress">In progress</option><option value="resolved">Resolved</option></select></div><h4>{item.subject}</h4><p className="feedback-message">{item.message}</p><div className="feedback-author"><span className="member-avatar">{(item.userId?.email || 'K')[0].toUpperCase()}</span><span><strong>{item.userId?.email || 'Kiara member'}</strong><small>{formatDate(item.createdAt)}</small></span></div></article>)}</div><Pagination data={data} page={page} setPage={setPage} /></>}
  </section>;
}

function HelpdeskView({ data, onStatus, page, setPage }: { data: PageData<Feedback> | null; onStatus: (item: Feedback, status: Feedback['status']) => void; page: number; setPage: (page: number) => void }) {
  return <section className="feedback-view"><div className="panel-heading"><div><h3>Help desk requests</h3><p>Review user questions and manage the support queue.</p></div><span className="count-pill">{data?.total ?? 0} requests</span></div>
    {!data?.items.length ? <div className="panel"><EmptyState title="No help desk requests" detail="New support requests will show up here." /></div> : <><div className="feedback-grid">{data.items.map((item) => <article className="feedback-card" key={item._id}><div className="feedback-top"><span className="feedback-rating">SUPPORT REQUEST</span><select aria-label="Request status" value={item.status} onChange={(event) => onStatus(item, event.target.value as Feedback['status'])}><option value="open">Open</option><option value="in_progress">In progress</option><option value="resolved">Resolved</option></select></div><h4>{item.subject}</h4><p className="feedback-message">{item.message}</p><div className="feedback-author"><span className="member-avatar">{(item.userId?.email || 'K')[0].toUpperCase()}</span><span><strong>{item.userId?.email || 'Kiara member'}</strong><small>{formatDate(item.createdAt)}</small></span></div></article>)}</div><Pagination data={data} page={page} setPage={setPage} /></>}
  </section>;
}

function PerformanceView({ data }: { data: AppPerformance | null }) {
  const stages = Object.entries(data?.stages ?? {});
  return <section className="performance-view"><div className="welcome-row"><div><p className="eyebrow"><span className="eyebrow-line" /> KIARA APP TELEMETRY</p><h2>App performance</h2><p>Runtime stage timings reported by the Kiara client.</p></div><span className="date-pill">Updated {data ? formatDate(new Date(data.timestamp).toISOString()) : '—'}</span></div>
    <div className="panel table-panel performance-panel"><div className="panel-heading"><div><h3>Stage timings</h3><p>Average, p95, minimum, and maximum duration in milliseconds.</p></div><span className="count-pill">{stages.length} stages</span></div>
      <div className="table-scroll"><table><thead><tr><th>STAGE</th><th>SAMPLES</th><th>AVERAGE</th><th>P95</th><th>MIN</th><th>MAX</th></tr></thead><tbody>{stages.map(([name, metrics]) => <tr key={name}><td>{name}</td><td>{metrics.count}</td><td>{metrics.avg.toFixed(1)} ms</td><td>{metrics.p95.toFixed(1)} ms</td><td>{metrics.min.toFixed(1)} ms</td><td>{metrics.max.toFixed(1)} ms</td></tr>)}</tbody></table>{stages.length === 0 && <EmptyState title="No performance events yet" detail="Collected app timings will appear once Kiara reports them." />}</div>
    </div>
  </section>;
}

function ContentView({ content, setContent, onSave, onUpload, onDelete, busy, deletingApk, uploadProgress, canEdit }: { content: WebsiteContent; setContent: (content: WebsiteContent) => void; onSave: (event: FormEvent<HTMLFormElement>) => void; onUpload: (event: FormEvent<HTMLFormElement>) => void; onDelete: () => void; busy: boolean; deletingApk: boolean; uploadProgress: ApkUploadProgress | null; canEdit: boolean }) {
  const apkDownloadHref = getApkDownloadHref(content);
  function update(field: keyof WebsiteContent, value: string) {
    setContent({ ...content, [field]: value });
  }
  return <div className="content-grid">{canEdit && <form className="panel editor-panel" onSubmit={onSave}><div className="panel-heading"><div><h3>Homepage story</h3><p>Changes appear on the public Kiara website.</p></div><span className="live-status"><i /> PUBLIC SITE</span></div>
    <label>Announcement bar<input maxLength={180} value={content.announcement} onChange={(event) => update('announcement', event.target.value)} placeholder="Optional launch update or announcement" /></label>
    <label>Eyebrow<input maxLength={80} value={content.heroEyebrow} onChange={(event) => update('heroEyebrow', event.target.value)} /></label>
    <label>Hero headline<input maxLength={120} value={content.heroTitle} onChange={(event) => update('heroTitle', event.target.value)} required /></label>
    <label>Hero description<textarea maxLength={600} rows={4} value={content.heroDescription} onChange={(event) => update('heroDescription', event.target.value)} required /></label>
    {content.features.map((feature, index) => <label key={index}>Feature {index + 1}<input maxLength={100} value={feature} onChange={(event) => setContent({ ...content, features: content.features.map((item, i) => i === index ? event.target.value : item) })} required /></label>)}
    <button className="button button-primary" type="submit">Save homepage changes <span>↗</span></button>
  </form>}
  <div className="content-side">{!canEdit && <section className="panel site-preview"><h3>Public website content</h3><p>{content.announcement || 'No announcement published'}</p><strong>{content.heroTitle}</strong><small>{content.heroDescription}</small><span>Developer access is read-only for website content.</span></section>}<section className="panel model-panel"><div className="panel-heading"><div><h3>Kiara Android app</h3><p>Upload the release APK to ImageKit.</p></div><span className="model-icon">⇧</span></div>
    <div className="model-drop"><span className="upload-icon">↑</span><strong>Publish an APK release</strong><small>Choose a valid Android .apk file, up to {formatBytes(content.apkMaxSizeBytes)}. ImageKit stores and serves the published APK.</small>{content.apkStorageConfigured === false && <p className="form-error storage-setup-warning">ImageKit is not configured on the server. Add IMAGEKIT_PUBLIC_KEY, IMAGEKIT_PRIVATE_KEY, and IMAGEKIT_URL_ENDPOINT, then restart the server before uploading.</p>}<form onSubmit={onUpload}><input name="apk" type="file" accept=".apk,application/vnd.android.package-archive" required disabled={busy || content.apkStorageConfigured === false} /><button className="button button-primary" disabled={busy || content.apkStorageConfigured === false}>{busy ? 'Uploading APK…' : 'Upload APK to ImageKit'}</button></form>
      {uploadProgress && <div className="upload-progress" role="status" aria-live="polite">{uploadProgress.stage === 'transferring' ? <><div className="upload-progress-label"><span>Sending APK to Kiara server…</span><strong>{uploadProgress.percentage}%</strong></div><div className="upload-progress-track" role="progressbar" aria-label="APK transfer to Kiara server" aria-valuemin={0} aria-valuemax={100} aria-valuenow={uploadProgress.percentage}><span style={{ width: `${uploadProgress.percentage}%` }} /></div><small>ImageKit upload starts after this transfer completes.</small></> : <><div className="upload-progress-label"><span>File received. Waiting for ImageKit…</span></div><div className="upload-progress-track upload-progress-indeterminate" role="progressbar" aria-label="Waiting for ImageKit upload result"><span /></div><small>We’ll confirm the upload only after ImageKit accepts the APK.</small></>}</div>}
    </div>
    <div className="model-current"><span className={`model-state ${content.apkAvailable ? 'available' : ''}`}><i />{content.apkAvailable ? `PUBLISHED ON ${(content.apkStorageProvider || 'imagekit').toUpperCase()}` : 'NOT PUBLISHED'}</span><strong>{content.apkOriginalName || 'No Android app uploaded yet'}</strong><small>{content.apkAvailable ? `${formatBytes(content.apkSize)} · Uploaded ${formatDate(content.apkUploadedAt || undefined)}` : 'The homepage download button appears after publishing an APK.'}</small>{apkDownloadHref && <a href={apkDownloadHref} target="_blank" rel="noreferrer">Download current APK ↗</a>}{canEdit && content.apkAvailable && <button className="button button-danger" type="button" onClick={onDelete} disabled={busy || deletingApk}>{deletingApk ? 'Deleting APK…' : 'Delete published APK'}</button>}</div>
  </section><div className="content-tip"><span>✦</span><p><strong>Release access</strong><br />New APK releases are stored in ImageKit. Admins and devs may upload a new APK; only admins may change website copy or remove a release.</p></div></div></div>;
}
function EmptyState({ title, detail }: { title: string; detail: string }) {
  return <div className="empty-state"><span>✧</span><strong>{title}</strong><p>{detail}</p></div>;
}

function PublicRoutes() {
  return <Routes>
    <Route path="/" element={<HomePage />} />
    <Route path="/features" element={<FeaturesPage />} />
    <Route path="/download" element={<DownloadPage />} />
    <Route path="/about" element={<AboutPage />} />
    <Route path="/docs" element={<DocsPage />} />
    <Route path="/faq" element={<FaqPage />} />
    <Route path="/privacy" element={<PolicyPage />} />
    <Route path="/terms" element={<TermsPage />} />
    <Route path="/contact" element={<ContactPage />} />
    <Route path="*" element={<HomePage />} />
  </Routes>;
}

export default function App() {
  return <BrowserRouter>
    <AppShell />
  </BrowserRouter>;
}

export function PrerenderedPage({ path }: { path: string }) {
  return <MemoryRouter initialEntries={[path]}>
    <AppShell />
  </MemoryRouter>;
}

function AppShell() {
  const location = useLocation();
  const isAdmin = location.pathname.replace(/\/+$/, '') === '/admin' || location.pathname.startsWith('/admin/');
  useEffect(() => {
    if (!isAdmin) return;

    document.title = 'Admin sign in | Kiara AI';
    setDocumentMeta('robots', 'noindex,nofollow');
    document.head.querySelector('link[rel="canonical"]')?.remove();
  }, [isAdmin]);

  return isAdmin ? <AdminApp /> : <PublicRoutes />;
}

function formDataForApk(file: File): FormData {
  const formData = new FormData();
  formData.append('apk', file);
  return formData;
}
