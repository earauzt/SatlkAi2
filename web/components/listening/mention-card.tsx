import { SourceBadge } from '@/components/source-badge';
import { CategoryChips } from '@/components/category-chips';
import { relTime, sentimentClientLabel } from '@/lib/mention-utils';
import { CASO_META } from '@/lib/inbox';
import { labelTema } from '@/lib/rules-listening';
import type { ListeningCard } from '@/lib/listening-data';

export function ListeningMentionCard({ card }: { card: ListeningCard }) {
  const caso = CASO_META[card.caso];
  const sent = card.sentiment !== null ? sentimentClientLabel(card.sentiment) : null;
  const border =
    card.caso === 'ataque' || (card.sentiment !== null && card.sentiment <= -1)
      ? 'border-l-rose-400'
      : card.caso === 'elogio'
        ? 'border-l-emerald-400'
        : card.caso === 'rumor'
          ? 'border-l-amber-400'
          : 'border-l-zinc-200';

  return (
    <article
      className={`min-w-0 rounded-2xl border border-zinc-200 border-l-4 bg-white p-4 shadow-sm ${border}`}
    >
      <div className="flex min-w-0 flex-wrap items-center gap-1.5">
        <SourceBadge source={card.mention.source} />
        <span className={`rounded-md px-2 py-0.5 text-xs font-medium ${caso.className}`}>
          {caso.label}
        </span>
        {sent && (
          <span className={`rounded-md px-2 py-0.5 text-xs font-medium ${sent.className}`}>
            {sent.text}
          </span>
        )}
        {card.mention.source === 'youtube' && (
          <span className="rounded-md bg-zinc-100 px-2 py-0.5 text-xs text-zinc-600">
            mención exacta
          </span>
        )}
        {card.flagged && (
          <span
            className="rounded-md bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-900"
            title={card.trollReasons.join(' · ')}
          >
            posible troll
          </span>
        )}
        {card.reprintCount > 1 && (
          <span className="rounded-md bg-zinc-900 px-2 py-0.5 text-xs font-medium text-white">
            visto {card.reprintCount} veces
          </span>
        )}
        <time className="text-xs text-zinc-400 sm:ml-auto">
          {relTime(card.mention.published_at)}
        </time>
      </div>

      <p className="mt-2 text-sm font-medium leading-snug text-zinc-900">
        {card.authorKnown ? card.authorLabel : 'Autor no identificado'}
        {card.followers !== null && card.followers > 0 && (
          <span className="ml-1 font-normal text-zinc-400">
            · {card.followers.toLocaleString('es-EC')} seg.
          </span>
        )}
      </p>

      {card.resumen && (
        <p className="mt-1.5 text-sm leading-snug text-zinc-800">{card.resumen}</p>
      )}

      <p className="mt-1.5 text-sm leading-relaxed break-words text-zinc-600 line-clamp-4">
        {card.mention.text}
      </p>

      <div className="mt-3 flex min-w-0 flex-wrap items-center gap-2">
        <CategoryChips tags={card.etiquetas} />
        {card.temas.map((tema) => (
          <span
            key={tema}
            className="rounded-full bg-zinc-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-zinc-600 ring-1 ring-inset ring-zinc-200"
          >
            {labelTema(tema)}
          </span>
        ))}
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-3 text-[11px] text-zinc-400">
        {card.sentimentOrigin === 'omitido_youtube' && <span>YouTube sin tono derivado</span>}
        {card.sentimentOrigin === 'sin_clasificar' && <span>sin clasificación</span>}
        {card.rulesOnly && <span>clasificado con reglas, no un modelo</span>}
        {card.model && !card.rulesOnly && <span>{card.model}</span>}
        {card.urgencia >= 2 && <span>urgencia {card.urgencia}</span>}
        {card.combinedReach > 0 && card.reprintCount > 1 && (
          <span>alcance {card.combinedReach}</span>
        )}
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
    </article>
  );
}
