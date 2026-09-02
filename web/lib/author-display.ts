import type { AuthorMeta, ListeningMention } from './types';

export function stripHtml(text: string): string {
  return text
    .replace(/<[^>]+>/g, ' ')
    .replace(/&quot;/gi, '"')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/\s+/g, ' ')
    .trim();
}

export function followersOf(meta: AuthorMeta | null | undefined): number | null {
  if (!meta) return null;
  const n = meta.followers;
  if (typeof n === 'number' && Number.isFinite(n)) return n;
  if (typeof n === 'string' && n.trim() !== '') {
    const parsed = Number(n);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

export function avatarUrlOf(meta: AuthorMeta | null | undefined): string | null {
  const t = meta?.thumbnails;
  const url = t?.medium?.url || t?.high?.url || t?.default?.url;
  if (typeof url !== 'string') return null;
  if (!/^https:\/\//i.test(url)) return null;
  return url;
}

function outletFromPressText(text: string): string | null {
  const clean = stripHtml(text);
  const emdash = clean.split('—')[0] ?? clean;
  const parts = emdash.split(' - ');
  if (parts.length >= 2) {
    const maybe = parts[parts.length - 1].trim();
    if (maybe.length >= 3 && maybe.length <= 80 && !/^https?:/i.test(maybe)) {
      return maybe;
    }
  }
  return null;
}

export type ResolvedAuthor = {
  handle: string | null;
  displayName: string | null;
  label: string;
  known: boolean;
  kind: 'cuenta' | 'medio' | 'canal' | 'desconocido';
  followers: number | null;
};

export function resolveAuthor(mention: ListeningMention): ResolvedAuthor {
  const handle = mention.author_handle?.trim() || null;
  const meta = mention.author_meta ?? {};
  const followers = followersOf(meta);
  const metaName = typeof meta.name === 'string' && meta.name.trim() ? meta.name.trim() : null;

  if (mention.source === 'x') {
    if (!handle || /^\d+$/.test(handle.replace(/^@/, ''))) {
      return {
        handle: null,
        displayName: metaName,
        label: 'Autor no identificado',
        known: false,
        kind: 'desconocido',
        followers,
      };
    }
    return {
      handle,
      displayName: metaName,
      label: metaName ? `${metaName} (${handle})` : handle,
      known: true,
      kind: 'cuenta',
      followers,
    };
  }

  if (mention.source === 'youtube') {
    if (!handle) {
      return {
        handle: null,
        displayName: null,
        label: 'Canal no identificado',
        known: false,
        kind: 'desconocido',
        followers,
      };
    }
    return {
      handle,
      displayName: handle,
      label: handle,
      known: true,
      kind: 'canal',
      followers,
    };
  }

  const outlet = outletFromPressText(mention.text);
  if (outlet) {
    return {
      handle: outlet,
      displayName: outlet,
      label: outlet,
      known: true,
      kind: 'medio',
      followers: null,
    };
  }

  if (handle && !/^Google News/i.test(handle)) {
    return {
      handle,
      displayName: handle,
      label: handle,
      known: true,
      kind: 'medio',
      followers: null,
    };
  }

  const feed = typeof meta.feed_name === 'string' ? meta.feed_name : null;
  return {
    handle: feed,
    displayName: null,
    label: 'Autor no identificado',
    known: false,
    kind: 'desconocido',
    followers: null,
  };
}
