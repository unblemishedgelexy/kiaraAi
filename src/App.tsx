import { useCallback, useEffect, useState, type FormEvent } from 'react';

const API_BASE = (import.meta.env.VITE_API_BASE_URL ?? '').replace(/\/+$/, '');
const heroImage = '/images/kiara_landing.png';
const ACCESS_TOKEN_KEY = 'kiara_admin_access_token';

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
  heroTitle: 'A little closer to the future.',
  heroDescription: 'Meet Kiara — a thoughtful AI companion who listens, remembers, and grows with you.',
  features: ['Natural voice and chat', 'A companion that remembers', 'Your own expressive 3D avatar'],
  apkAvailable: false,
  apkDownloadUrl: null,
  apkOriginalName: null,
  apkSize: null,
  apkUploadedAt: null,
  apkMaxSizeBytes: 25 * 1024 * 1024,
  apkStorageConfigured: true,
};

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
  return <a className={`brand${light ? ' brand-light' : ''}`} href="/" aria-label="Kiara AI home">
    <img className="brand-symbol" src="/images/kiara-logo.svg" alt="" />
    <span>kiara<span className="brand-dot">.</span></span>
  </a>;
}

function HomePage() {
  const [content, setContent] = useState(defaults);
  const [loadError, setLoadError] = useState('');
  const apkDownloadHref = getApkDownloadHref(content);

  useEffect(() => {
    void request<WebsiteContent>('/site/content')
      .then(setContent)
      .catch((error: unknown) => setLoadError(error instanceof Error ? error.message : 'Could not load Kiara details.'));
  }, []);

  return <main className="landing">
    {content.announcement && <div className="announcement">{content.announcement}</div>}
    <header className="site-header">
      <Brand />
      <nav className="site-nav" aria-label="Main navigation">
        <a href="#experience">The experience</a>
        <a href="#features">Why Kiara</a>
        <a href="#about">About</a>
      </nav>
      <a className="nav-cta" href="#experience">Meet Kiara <span>↗</span></a>
    </header>
    <p className="header-blessing">श्री गणेशाय नमः</p>

    <section className="hero" id="experience">
      <div className="hero-copy">
        <p className="eyebrow"><span className="eyebrow-line" />{content.heroEyebrow}</p>
        <h1>{content.heroTitle.split(' ').slice(0, -2).join(' ')} <em>{content.heroTitle.split(' ').slice(-2).join(' ')}</em></h1>
        <p className="hero-description">{content.heroDescription}</p>
        <div className="hero-actions">
          <a className="button button-primary" href={content.apkAvailable && apkDownloadHref ? apkDownloadHref : '#features'}>
            {content.apkAvailable ? 'Download Kiara for Android' : 'Discover Kiara'} <span>↗</span>
          </a>
          <a className="button button-quiet" href="#features"><span className="play-icon">▶</span> Explore the experience</a>
        </div>
        {loadError && <p className="inline-error">{loadError}</p>}
        <div className="hero-note"><span className="online-dot" /> Made for meaningful moments <span className="note-divider" /> Thoughtfully designed, always evolving</div>
      </div>
      <div className="hero-art">
        <div className="art-glow" />
        <div className="art-frame">
          <img src={heroImage} alt="Kiara, your virtual AI companion" />
          <div className="image-caption"><span className="caption-spark">✦</span><span><strong>Meet Kiara</strong><small>Your thoughtful AI companion</small></span><span className="caption-arrow">↗</span></div>
        </div>
        <div className="orbit orbit-one" /><div className="orbit orbit-two" />
        <div className="floating-chip chip-memory"><span>✦</span> She remembers what matters</div>
        <div className="floating-chip chip-voice"><span className="wave">〰</span> A voice that feels close</div>
      </div>
      <div className="hero-bottom"><span>01 — 03</span><span>SCROLL TO EXPLORE</span><span className="scroll-line" /></div>
    </section>

    <section className="intro-strip" id="about">
      <div className="intro-mark">K.</div>
      <p>Not just another assistant.<br /><strong>A presence that grows with you.</strong></p>
      <span className="intro-caption">A new kind of connection, designed around you.</span>
    </section>

    <section className="feature-section" id="features">
      <div className="section-heading">
        <div><p className="eyebrow"><span className="eyebrow-line" /> A MORE HUMAN KIND OF AI</p><h2>Technology, with<br /><em>a little more heart.</em></h2></div>
        <p className="section-description">Kiara brings conversation, memory, and presence together in one personal experience. A companion that feels natural from the very first hello.</p>
      </div>
      <div className="feature-grid">
        {content.features.map((feature, index) => <article className={`feature-card feature-${index + 1}`} key={feature}>
          <span className="feature-number">0{index + 1}</span><span className="feature-symbol">{['◉', '✧', '◌'][index] || '✦'}</span>
          <h3>{feature}</h3>
          <p>{[
            'Talk naturally, type when you want, and let the conversation find its own rhythm.',
            'Kiara keeps the details that make your conversations feel personal and connected.',
            'An expressive, living avatar brings a little more presence to every moment.',
          ][index]}</p>
          <span className="feature-link">Designed around you <b>↗</b></span>
        </article>)}
      </div>
    </section>

    <section className="download-banner">
      <div><p className="eyebrow"><span className="eyebrow-line" /> YOUR NEXT CHAPTER</p><h2>Make room for<br /><em>something meaningful.</em></h2></div>
      <div className="download-action"><p>Start a conversation with Kiara. Your next favorite moment could be one hello away.</p><a className="button button-primary" href={content.apkAvailable && apkDownloadHref ? apkDownloadHref : '#experience'}>{content.apkAvailable ? 'Download Kiara for Android' : 'Explore Kiara'} <span>↗</span></a>{content.apkAvailable && <small className="apk-caption">{content.apkOriginalName} · {formatBytes(content.apkSize)}</small>}</div>
    </section>
    <footer className="site-footer"><Brand light /><span>© {new Date().getFullYear()} Kiara AI. Created for connection.</span></footer>
  </main>;
}

type AdminSection = 'overview' | 'users' | 'subscriptions' | 'feedback' | 'helpdesk' | 'performance' | 'content';

function AdminLogin({ onLogin, onRegister, initialError, darkMode, onToggleTheme }: {
  onLogin: (email: string, password: string) => Promise<void>;
  onRegister: (firstName: string, lastName: string, email: string, password: string) => Promise<void>;
  initialError: string;
  darkMode: boolean;
  onToggleTheme: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(initialError);
  const [notice, setNotice] = useState('');
  const [registering, setRegistering] = useState(false);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => setError(initialError), [initialError]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError('');
    setNotice('');
    try {
      if (registering) {
        await onRegister(firstName, lastName, email, password);
        setPassword('');
        setRegistering(false);
        setNotice('First admin account created. Sign in with your new credentials.');
      } else {
        await onLogin(email, password);
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : registering ? 'Admin registration failed.' : 'Sign-in failed.');
    } finally {
      setBusy(false);
    }
  }

  return <main className="login-screen" data-theme={darkMode ? 'dark' : 'light'}>
    <div className="login-art">
      <img className="login-art-image" src="/images/admin-login.png" alt="Kiara at her desk" />
      <div className="login-art-tint" />
      <Brand light />
      <p>Every meaningful connection<br />starts with a hello.</p>
      <span>KIARA ADMINISTRATION</span>
    </div>
    <form className="login-form" onSubmit={submit}>
      <button className="theme-toggle login-theme-toggle" type="button" onClick={onToggleTheme} aria-pressed={darkMode}>
        <span aria-hidden="true">{darkMode ? '☀' : '☾'}</span>{darkMode ? 'Light mode' : 'Dark mode'}
      </button>
      <a className="back-link" href="/">← Back to Kiara</a><div className="login-form-content"><p className="eyebrow"><span className="eyebrow-line" /> SECURE ADMIN ACCESS</p><h1>{registering ? <>Create your<br /><em>account.</em></> : <>Welcome<br /><em>back.</em></>}</h1><p className="login-copy">{registering ? 'Register the first admin account. The server allows this only while no admin account exists.' : 'Sign in with the email and password provisioned for your admin account.'}</p>
        {error && <p className="form-error">{error}</p>}
        {notice && <p className="form-success" role="status">{notice}</p>}
        {registering && <>
          <label className="login-field">First name
            <input type="text" name="given-name" autoComplete="given-name" maxLength={80} required value={firstName} onChange={(event) => setFirstName(event.target.value)} />
          </label>
          <label className="login-field">Last name
            <input type="text" name="family-name" autoComplete="family-name" maxLength={80} required value={lastName} onChange={(event) => setLastName(event.target.value)} />
          </label>
        </>}
        <label className="login-field">Admin email
          <input type="email" name="email" autoComplete="username" required value={email} onChange={(event) => setEmail(event.target.value)} />
        </label>
        <label className="login-field">Password
          <span className="password-input-wrap">
            <input type={showPassword ? 'text' : 'password'} name="password" autoComplete={registering ? 'new-password' : 'current-password'} minLength={registering ? 12 : undefined} required value={password} onChange={(event) => setPassword(event.target.value)} />
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
        <button className="button button-primary login-submit" disabled={busy}>{busy ? registering ? 'Creating account…' : 'Signing in…' : registering ? 'Create first admin account' : 'Sign in to admin'}</button>
        <button className="login-mode-toggle" type="button" disabled={busy} onClick={() => { setRegistering((current) => !current); setError(''); setNotice(''); }}>{registering ? 'Already have an admin account? Sign in' : 'First admin? Create an account'}</button>
        <p className="secure-note">{registering ? 'Only the first admin can register without a server registration key. Further admin accounts require the key.' : 'Only active admin or developer accounts can sign in. Regular user accounts cannot access the admin panel.'}</p>
      </div>
    </form>
  </main>;
}

function MetricCard({ label, value, note, icon }: { label: string; value: string; note: string; icon: string }) {
  return <article className="metric-card"><span className="metric-icon">{icon}</span><span className="metric-label">{label}</span><strong>{value}</strong><small>{note}</small></article>;
}

function AdminApp() {
  const [darkMode, setDarkMode] = useState(() => localStorage.getItem('kiara_admin_theme') === 'dark');
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
      localStorage.setItem('kiara_admin_theme', next ? 'dark' : 'light');
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

  async function registerFirstAdmin(firstName: string, lastName: string, email: string, password: string) {
    const response = await fetch(`${API_BASE}/api/admin/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ firstName, lastName, email, password }),
    });
    const payload = await response.json().catch(() => ({})) as { success?: boolean; message?: string };
    if (!response.ok || payload.success === false) {
      throw new Error(payload.message || `Registration failed (${response.status}).`);
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
  if (!authenticated) return <AdminLogin onLogin={loginWithPassword} onRegister={registerFirstAdmin} initialError={error} darkMode={darkMode} onToggleTheme={toggleTheme} />;

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

export default function App() {
  const isAdmin = window.location.pathname.replace(/\/+$/, '') === '/admin';
  return isAdmin ? <AdminApp /> : <HomePage />;
}

function formDataForApk(file: File): FormData {
  const formData = new FormData();
  formData.append('apk', file);
  return formData;
}
