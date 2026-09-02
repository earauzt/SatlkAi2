import { SourceBadge } from '@/components/source-badge';
import { CategoryChips } from '@/components/category-chips';
import { HighlightedText } from './highlighted-text';
import { relTime, sentimentClientLabel } from '@/lib/mention-utils';
import { CASO_META } from '@/lib/inbox';
import { labelTema } from '@/lib/rules-listening';
import type { ListeningCard } from '@/lib/listening-data';
import type { InboxStatus } from '@/lib/inbox-status';
import { INBOX_STATUS_META, INBOX_STATUSES } from '@/lib/inbox-status';

function AuthorAvatar({ name, src }: { name: string; src: string | null }) {
  const initial = (name || '?').charAt(0).toUpperCase();
  if (src) {
    return (
      // Miniatura real (YouTube). X no guarda foto de perfil.
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt=""
        className="h-10 w-10 shrink-0 rounded-full bg-zinc-200 object-cover"
      />
    );
  }
  return (
    <div
      aria-hidden
      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-zinc-200 text-sm font-semibold text-zinc-600"
    >
      {initial}
    </div>
  );
}

function UrgencyCue({ level }: { level: number }) {
  if (level < 2) return null;
  const styles = level >= 3 ? 'bg-red-600 text-white' : 'bg-orange-500 text-white';
  return (
    <span className={`rounded-md px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${styles}`}>
      Urgencia {level}
    </span>
  );
}

export function ListeningMentionCard({
  card,
  status = 'open',
  onStatus,
}: {
  card: ListeningCard;
  status?: InboxStatus;
  onStatus?: (id: string, next: InboxStatus) => void;
}) {
  const caso = CASO_META[card.caso];
  const sent = card.sentiment !== null ? sentimentClientLabel(card.sentiment) : null;
  const displayName =
    card.authorDisplayName ||
    (card.authorKnown ? card.authorLabel : 'Autor no identificado');
  const showHandle =
    Boolean(card.authorHandle) &&
    card.authorHandle !== displayName &&
    !displayName.includes(card.authorHandle ?? '');
  const border =
    card.urgencia >= 3
      ? 'border-l-red-500'
      : card.caso === 'ataque' || (card.sentiment !== null && card.sentiment <= -1)
        ? 'border-l-rose-400'
        : card.caso === 'elogio'
          ? 'border-l-emerald-400'
          : card.caso === 'rumor'
            ? 'border-l-amber-400'
            : 'border-l-zinc-200';
  const reach = card.combinedReach > 0 ? card.combinedReach : card.mention.reach_score;
  const avatarName = displayName || card.authorHandle || card.mention.source;

  return (
    <article
      className={`min-w-0 rounded-2xl border border-zinc-200 border-l-4 bg-white p-4 shadow-sm ${border}`}
    >
      <div className="flex min-w-0 gap-3">
        <AuthorAvatar name={avatarName} src={card.avatarUrl} />
        <div className="min-w-0 flex-1">
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
            <UrgencyCue level={card.urgencia} />
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

          <p className="mt-1.5 text-sm font-medium leading-snug text-zinc-900">
            {displayName}
            {showHandle && (
              <span className="ml-1 font-normal text-zinc-500">{card.authorHandle}</span>
            )}
          </p>

          {card.resumen && (
            <p className="mt-1.5 text-sm leading-snug text-zinc-800">{card.resumen}</p>
          )}

          <p className="mt-1.5 text-sm leading-relaxed break-words text-zinc-600 line-clamp-4">
            <HighlightedText text={card.mention.text} terms={card.highlightTerms} />
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

          <div className="mt-2 flex flex-wrap items-center gap-3 text-[11px] text-zinc-500">
            {card.followers !== null && card.followers > 0 && (
              <span>{card.followers.toLocaleString('es-EC')} seg.</span>
            )}
            {reach > 0 && <span>alcance {reach}</span>}
            {card.sentimentOrigin === 'omitido_youtube' && <span>YouTube sin tono derivado</span>}
            {card.sentimentOrigin === 'sin_clasificar' && <span>sin clasificación</span>}
            {card.rulesOnly && <span>clasificado con reglas, no un modelo</span>}
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

          {onStatus && (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {INBOX_STATUSES.map((id) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => onStatus(card.mention.id, id)}
                  className={`min-h-9 rounded-lg px-2.5 text-xs font-medium ${
                    status === id
                      ? 'bg-zinc-900 text-white'
                      : 'bg-zinc-100 text-zinc-700 hover:bg-zinc-200'
                  }`}
                >
                  {INBOX_STATUS_META[id].label}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </article>
  );
}
