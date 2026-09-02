type SemanticNarrative = {
  id: string;
  label: string;
  mention_count: number;
  last_seen_at: string;
  trend: number;
};

export function SemanticNarratives({ items }: { items: SemanticNarrative[] }) {
  if (items.length === 0) {
    return (
      <p className="text-sm text-zinc-500">
        Sin clusters semánticos aún. Ejecuta <code className="rounded bg-zinc-100 px-1">npm run embeddings</code>{' '}
        con OPENAI_API_KEY.
      </p>
    );
  }

  const max = Math.max(...items.map((i) => i.mention_count), 1);

  return (
    <ul className="space-y-2">
      {items.map((n) => (
        <li
          key={n.id}
          className="rounded-xl border border-violet-200 bg-violet-50/50 p-4 shadow-sm"
        >
          <div className="flex items-center gap-2">
            <span className="rounded-md bg-violet-100 px-2 py-0.5 text-[10px] font-bold uppercase text-violet-700">
              Semántico
            </span>
            <span className="text-xs text-zinc-500">{n.mention_count} menciones similares</span>
          </div>
          <p className="mt-2 text-sm font-medium text-zinc-900 line-clamp-2">{n.label}</p>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-violet-100">
            <div
              className="h-full rounded-full bg-violet-500"
              style={{ width: `${(n.mention_count / max) * 100}%` }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}
