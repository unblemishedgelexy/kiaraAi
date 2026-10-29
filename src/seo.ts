const siteUrl = 'https://kiaraai.in';
const logoUrl = `${siteUrl}/favicon-256.png`;

export const publicPageMetadata = {
  '/': {
    title: 'Kiara AI | Android companion for conversation and reflection',
    description: 'Meet Kiara, an Android AI companion for everyday text and voice conversations, clearer self-expression, and personal reflection.',
  },
  '/features': {
    title: 'Kiara AI features | Voice, memory, avatar, and context',
    description: 'Explore Kiara Android features including text and live voice conversations, context memory, an animated 3D avatar, and optional attachments.',
  },
  '/download': {
    title: 'Download Kiara for Android | Release and installation',
    description: 'Check the current Kiara Android APK release, Android 7.0+ compatibility, installation steps, and known product limitations.',
  },
  '/about': {
    title: 'About Kiara AI | Communication, reflection, and growth',
    description: 'Learn Kiara’s purpose: support everyday communication, self-expression, and reflection while keeping human relationships central.',
  },
  '/docs': {
    title: 'Getting started with Kiara | Android installation and conversations',
    description: 'Learn how to install Kiara on Android 7.0 or later, start a text or voice conversation, and review privacy and sharing controls.',
  },
  '/faq': {
    title: 'Kiara AI FAQ | Android features, availability, and privacy',
    description: 'Answers about Kiara’s Android app, voice and memory features, APK availability, privacy drafts, and product limitations.',
  },
  '/privacy': {
    title: 'Kiara AI Privacy Policy draft | Data and privacy',
    description: 'Read the privacy-policy draft supplied with Kiara and its review notices about data providers, storage, retention, and safeguards.',
  },
  '/terms': {
    title: 'Kiara AI Terms and Conditions draft',
    description: 'Read Kiara’s Terms and Conditions draft and its publication-review notes.',
  },
  '/contact': {
    title: 'Contact Kiara AI | Support information',
    description: 'Find the support contact listed in Kiara’s supplied legal draft and review what remains unverified.',
  },
} as const;

export type PublicPagePath = keyof typeof publicPageMetadata;

export function normalizePublicPath(path: string): PublicPagePath {
  const normalizedPath = path.replace(/\/+$/, '') || '/';
  return normalizedPath in publicPageMetadata ? normalizedPath as PublicPagePath : '/';
}

export function getPageMetadata(path: string) {
  return publicPageMetadata[normalizePublicPath(path)];
}

export function getStructuredData(path: string) {
  const pagePath = normalizePublicPath(path);
  const graph: Record<string, unknown>[] = [];

  if (pagePath === '/') {
    graph.push(
      {
        '@type': 'WebSite',
        '@id': `${siteUrl}/#website`,
        name: 'Kiara AI',
        alternateName: 'Kiara',
        url: `${siteUrl}/`,
        description: publicPageMetadata['/'].description,
        publisher: { '@id': `${siteUrl}/#organization` },
      },
      {
        '@type': 'Organization',
        '@id': `${siteUrl}/#organization`,
        name: 'Kiara AI',
        url: `${siteUrl}/`,
        logo: logoUrl,
      },
    );
  }

  if (pagePath === '/' || pagePath === '/download') {
    graph.push({
      '@type': ['SoftwareApplication', 'MobileApplication'],
      '@id': `${siteUrl}/#application`,
      name: 'Kiara AI',
      description: 'An Android AI companion for everyday text and live voice conversations, context memory, an animated 3D avatar, and optional photo or file context. Availability depends on permissions, network access, and configured services.',
      operatingSystem: 'Android 7.0 (API 24) and later',
      applicationCategory: 'CommunicationApplication',
      url: `${siteUrl}/download`,
      installUrl: `${siteUrl}/download`,
      publisher: { '@id': `${siteUrl}/#organization` },
    });
  }

  if (graph.length === 0) return null;

  return {
    '@context': 'https://schema.org',
    '@graph': graph,
  };
}
