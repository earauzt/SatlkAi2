'use client';

import { useState, useTransition } from 'react';
import { createClient } from '@/lib/supabase/client';
import { CategoryChips } from '@/components/category-chips';
import { SourceBadge } from '@/components/source-badge';

type ReviewItem = {
  mention_id: string;
  text: string;
  url: string | null;
  source: string;
  published_at: string;
  sentimiento: number;
  etiquetas: string[];
  resumen: string | null;
  urgencia: number;
  confianza: number;
  model: string;
};

export function ReviewQueue({ items }: { items: ReviewItem[] }) {
  const [queue, setQueue] = useState(items);
  const [pending, startTransition] = useTransition();
  const supabase = createClient();

  function markReviewed(mentionId: string) {
    startTransition(async () => {
      const { error } = await supabase.rpc('monitor_mark_reviewed', {
        p_mention_id: mentionId,
      });
      if (!error) setQueue((q) => q.filter((i) => i.mention_id !== mentionId));
    });
  }

  if (queue.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-zinc-300 bg-white p-12 text-center">
        <p className="text-sm font-medium text-zinc-900">Cola vacía</p>
        <p className="mt-1 text-sm text-zinc-500">No hay menciones pendientes de revisión.</p>
      </div>
    );
  }

  return (
    <ul className="space-y-3">
      {queue.map((item) => (
        <li
          key={item.mention_id}
          className={`rounded-xl border border-zinc-200 border-l-4 bg-white p-4 shadow-sm ${
            item.urgencia >= 2 ? 'border-l-red-500' : 'border-l-amber-400'
          }`}
        >
          <div className="flex flex-wrap items-center gap-2 text-xs text-zinc-500">
            <SourceBadge source={item.source} />
            <span>confianza {(item.confianza * 100).toFixed(0)}%</span>
            <span>urgencia {item.urgencia}</span>
            <span className="text-zinc-400">{item.model}</span>
          </div>
          {item.resumen && (
            <p className="mt-2 text-sm font-medium text-zinc-900">{item.resumen}</p>
          )}
          <p className="mt-1 text-sm text-zinc-600 line-clamp-2">{item.text}</p>
          <div className="mt-2">
            <CategoryChips tags={item.etiquetas} />
          </div>
          <div className="mt-3 flex gap-3">
            {item.url && (
              <a
                href={item.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs font-medium text-zinc-900 underline"
              >
                Ver original
              </a>
            )}
            <button
              type="button"
              disabled={pending}
              onClick={() => markReviewed(item.mention_id)}
              className="ml-auto rounded-lg bg-zinc-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-zinc-800 disabled:opacity-50"
            >
              Marcar revisado
            </button>
          </div>
        </li>
      ))}
    </ul>
  );
}
