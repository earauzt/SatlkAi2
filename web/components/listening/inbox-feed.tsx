'use client';

import { useCallback, useMemo, useState, useSyncExternalStore } from 'react';
import { ListeningMentionCard } from './mention-card';
import type { ListeningCard } from '@/lib/listening-data';
import {
  INBOX_STATUS_EVENT,
  INBOX_STATUS_META,
  INBOX_STATUS_STORAGE_KEY,
  type InboxStatus,
} from '@/lib/inbox-status';

type StatusFilter = InboxStatus | 'all';

function readStore() {
  try {
    return localStorage.getItem(INBOX_STATUS_STORAGE_KEY) ?? '{}';
  } catch {
    return '{}';
  }
}

function subscribe(onStoreChange: () => void) {
  window.addEventListener('storage', onStoreChange);
  window.addEventListener(INBOX_STATUS_EVENT, onStoreChange);
  return () => {
    window.removeEventListener('storage', onStoreChange);
    window.removeEventListener(INBOX_STATUS_EVENT, onStoreChange);
  };
}

function parseMap(raw: string): Record<string, InboxStatus> {
  try {
    const value = JSON.parse(raw) as Record<string, unknown>;
    const out: Record<string, InboxStatus> = {};
    for (const [key, item] of Object.entries(value)) {
      if (item === 'open' || item === 'seen' || item === 'follow_up') out[key] = item;
    }
    return out;
  } catch {
    return {};
  }
}

function writeMap(map: Record<string, InboxStatus>) {
  const next: Record<string, InboxStatus> = {};
  for (const [key, value] of Object.entries(map)) {
    if (value !== 'open') next[key] = value;
  }
  localStorage.setItem(INBOX_STATUS_STORAGE_KEY, JSON.stringify(next));
  window.dispatchEvent(new Event(INBOX_STATUS_EVENT));
}

export function InboxFeed({ cards }: { cards: ListeningCard[] }) {
  const raw = useSyncExternalStore(subscribe, readStore, () => '{}');
  const map = useMemo(() => parseMap(raw), [raw]);
  const [filter, setFilter] = useState<StatusFilter>('open');

  const statusOf = useCallback(
    (id: string): InboxStatus => map[id] ?? 'open',
    [map]
  );

  const setStatus = useCallback(
    (id: string, next: InboxStatus) => {
      writeMap({ ...map, [id]: next });
    },
    [map]
  );

  const counts = useMemo(() => {
    const c = { open: 0, seen: 0, follow_up: 0 };
    for (const card of cards) c[statusOf(card.mention.id)] += 1;
    return c;
  }, [cards, statusOf]);

  const visible = useMemo(() => {
    if (filter === 'all') return cards;
    return cards.filter((card) => statusOf(card.mention.id) === filter);
  }, [cards, filter, statusOf]);

  return (
    <section className="mt-4 space-y-3">
      <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs text-zinc-500">
          {visible.length} hilos
          {filter !== 'all' ? ` · ${INBOX_STATUS_META[filter].label.toLowerCase()}` : ''}
          {' · '}el estado lo marca el usuario · sin respuesta automática
        </p>
        <div className="flex min-w-0 flex-wrap gap-1.5">
          {(
            [
              ['open', `Abiertos ${counts.open}`],
              ['follow_up', `Seguimiento ${counts.follow_up}`],
              ['seen', `Vistos ${counts.seen}`],
              ['all', 'Todos'],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setFilter(id)}
              className={`inline-flex min-h-9 items-center rounded-lg px-2.5 text-xs font-medium ${
                filter === id
                  ? 'bg-zinc-900 text-white'
                  : 'bg-white text-zinc-700 ring-1 ring-zinc-200 hover:bg-zinc-50'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {cards.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-zinc-300 bg-white p-10 text-center">
          <p className="text-sm font-medium">Nada en este filtro</p>
          <p className="mt-1 text-sm text-zinc-500">Cambia caso, tono, alias o fuente.</p>
        </div>
      ) : visible.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-zinc-300 bg-white p-10 text-center">
          <p className="text-sm font-medium">
            Nada en {filter === 'all' ? 'este filtro' : INBOX_STATUS_META[filter].label.toLowerCase()}
          </p>
          <p className="mt-1 text-sm text-zinc-500">
            El estado vive en este dispositivo. Probá «Todos».
          </p>
        </div>
      ) : (
        visible.map((card) => (
          <ListeningMentionCard
            key={card.mention.id}
            card={card}
            status={statusOf(card.mention.id)}
            onStatus={setStatus}
          />
        ))
      )}
    </section>
  );
}
