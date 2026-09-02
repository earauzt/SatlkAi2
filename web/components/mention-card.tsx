'use client';

import { CategoryChips } from '@/components/category-chips';
import { SourceBadge } from '@/components/source-badge';
import type { Mention } from '@/lib/types';
import { getClassification, relTime, sentimentLabel } from '@/lib/mention-utils';

function UrgencyBadge({ level }: { level: number }) {
  if (level < 2) return null;
  const styles =
    level >= 3
      ? 'bg-red-600 text-white'
      : 'bg-orange-500 text-white';
  return (
    <span className={`rounded-md px-2 py-0.5 text-[10px] font-bold uppercase ${styles}`}>
      Urgencia {level}
    </span>
  );
}

function AuthorAvatar({ name }: { name: string }) {
  const initial = (name || '?').charAt(0).toUpperCase();
  return (
    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-zinc-200 text-sm font-semibold text-zinc-600">
      {initial}
    </div>
  );
}

export function MentionCard({
  mention,
  showTarget = true,
}: {
  mention: Mention;
  showTarget?: boolean;
}) {
  const c = getClassification(mention.classifications);
  const author = mention.author_handle || mention.source;
  const sent = c ? sentimentLabel(c.sentimiento) : null;
  const border =
    (c?.urgencia ?? 0) >= 3
      ? 'border-l-red-500'
      : (c?.urgencia ?? 0) >= 2
        ? 'border-l-orange-400'
        : 'border-l-zinc-200';

  return (
    <article
      className={`group rounded-xl border border-zinc-200 border-l-4 bg-white p-4 shadow-sm transition-shadow hover:shadow-md ${border}`}
    >
      <div className="flex gap-3">
        <AuthorAvatar name={author} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="truncate text-sm font-semibold text-zinc-900">{author}</span>
            <SourceBadge source={mention.source} />
            {showTarget && mention.target_name && (
              <span className="rounded-md bg-violet-100 px-1.5 py-0.5 text-[10px] font-medium text-violet-800">
                {mention.target_name}
              </span>
            )}
            {sent && (
              <span className={`rounded-md px-1.5 py-0.5 text-[10px] font-medium ${sent.className}`}>
                {sent.text}
              </span>
            )}
            <UrgencyBadge level={c?.urgencia ?? 0} />
            <time className="ml-auto text-xs text-zinc-400">{relTime(mention.published_at)}</time>
          </div>

          {c?.resumen && (
            <p className="mt-2 text-sm font-medium leading-snug text-zinc-800">{c.resumen}</p>
          )}

          <p className="mt-1.5 text-sm leading-relaxed text-zinc-600 line-clamp-3">{mention.text}</p>

          <div className="mt-3 flex flex-wrap items-center gap-3">
            {c?.etiquetas && <CategoryChips tags={c.etiquetas} />}
            {c && (
              <span className="text-[10px] text-zinc-400">
                IA {(c.confianza * 100).toFixed(0)}% confianza
              </span>
            )}
            {mention.reach_score > 0 && (
              <span className="text-[10px] text-zinc-400">alcance {mention.reach_score}</span>
            )}
          </div>

          {mention.url && (
            <a
              href={mention.url}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-3 inline-flex items-center text-xs font-medium text-zinc-900 underline-offset-2 hover:underline"
            >
              Ver publicación original →
            </a>
          )}
        </div>
      </div>
    </article>
  );
}
