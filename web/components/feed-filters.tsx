'use client';

import { useRouter, useSearchParams } from 'next/navigation';

const SOURCES = [
  { id: '', label: 'Todas' },
  { id: 'google_news', label: 'Google News' },
  { id: 'rss', label: 'Prensa' },
  { id: 'youtube', label: 'YouTube' },
  { id: 'x', label: 'X / Twitter' },
];

const URGENCIES = [
  { id: '', label: 'Cualquier urgencia' },
  { id: '2', label: 'Urgente (≥2)' },
  { id: '3', label: 'Crítico (3)' },
];

export function FeedFilters() {
  const router = useRouter();
  const params = useSearchParams();

  function update(key: string, value: string) {
    const next = new URLSearchParams(params.toString());
    if (value) next.set(key, value);
    else next.delete(key);
    router.push(`/feed?${next.toString()}`);
  }

  const source = params.get('source') ?? '';
  const urgency = params.get('urgency') ?? '';
  const q = params.get('q') ?? '';

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-zinc-200 bg-white p-4 shadow-sm sm:flex-row sm:flex-wrap sm:items-center">
      <input
        type="search"
        placeholder="Buscar en menciones..."
        defaultValue={q}
        onKeyDown={(e) => {
          if (e.key === 'Enter') update('q', (e.target as HTMLInputElement).value);
        }}
        className="min-w-[200px] flex-1 rounded-lg border border-zinc-200 px-3 py-2 text-sm outline-none ring-zinc-900 focus:ring-2"
      />
      <select
        value={source}
        onChange={(e) => update('source', e.target.value)}
        className="rounded-lg border border-zinc-200 px-3 py-2 text-sm"
      >
        {SOURCES.map((s) => (
          <option key={s.id} value={s.id}>
            {s.label}
          </option>
        ))}
      </select>
      <select
        value={urgency}
        onChange={(e) => update('urgency', e.target.value)}
        className="rounded-lg border border-zinc-200 px-3 py-2 text-sm"
      >
        {URGENCIES.map((u) => (
          <option key={u.id} value={u.id}>
            {u.label}
          </option>
        ))}
      </select>
    </div>
  );
}
