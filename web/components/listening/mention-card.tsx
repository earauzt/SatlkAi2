import { SourceBadge } from '@/components/source-badge';
import { TROLL_DISCLAIMER } from '@/lib/constants';
import { relTime, sentimentClientLabel } from '@/lib/mention-utils';
import type { ListeningCard } from '@/lib/listening-data';

export function ListeningMentionCard({ card }: { card: ListeningCard }) {
  const sent = sentimentClientLabel(card.sentiment);
  const border = card.flagged
    ? 'border-l-amber-400'
    : card.sentiment < 0
      ? 'border-l-rose-300'
      : card.sentiment > 0
        ? 'border-l-emerald-300'
        : 'border-l-slate-200';

  return (
    <article
      className={`min-w-0 rounded-2xl border border-zinc-200 border-l-4 bg-white p-4 shadow-sm ${border}`}
    >
      <div className="flex min-w-0 flex-col gap-2">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <SourceBadge source={card.mention.source} />
          <span className={`rounded-md px-2 py-0.5 text-xs font-medium ${sent.className}`}>
            {sent.text}
          </span>
          {card.themes.slice(0, 2).map((theme) => (
            <span
              key={theme}
              className="max-w-full truncate rounded-md bg-zinc-100 px-2 py-0.5 text-xs text-zinc-700"
            >
              {theme}
            </span>
          ))}
          <time className="text-xs text-zinc-400 sm:ml-auto">{relTime(card.mention.published_at)}</time>
        </div>

        <p className="text-sm font-medium leading-snug text-zinc-900">
          {card.authorKnown ? card.authorLabel : 'Autor no identificado'}
        </p>

        {card.flagged && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2">
            <p className="text-xs font-semibold text-amber-900">Posible troll o cuenta inauténtica</p>
            <p className="mt-0.5 text-xs leading-relaxed text-amber-800">{TROLL_DISCLAIMER}</p>
            {card.trollReasons.length > 0 && (
              <p className="mt-1 text-[11px] text-amber-700">{card.trollReasons.join(' · ')}</p>
            )}
          </div>
        )}

        <p className="text-sm leading-relaxed break-words text-zinc-600 line-clamp-4">
          {card.mention.text}
        </p>

        <div className="flex flex-wrap items-center gap-3 text-[11px] text-zinc-400">
          <span>
            {card.sentimentOrigin === 'clasificacion'
              ? 'sentimiento en classifications'
              : 'sentimiento por reglas (sin fila de clasificación)'}
          </span>
          {card.mention.url && (
            <a
              href={card.mention.url}
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium text-zinc-800 underline-offset-2 hover:underline"
            >
              Ver original
            </a>
          )}
        </div>
      </div>
    </article>
  );
}
