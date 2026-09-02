'use client';

type Cluster = {
  cluster_key: string;
  cluster_type: string;
  mention_count: number;
  avg_sentimiento: number;
  sample_resumen: string | null;
  last_seen: string;
};

function ClusterList({ items }: { items: Cluster[] }) {
  const max = Math.max(...items.map((i) => i.mention_count), 1);

  return (
    <ul className="space-y-2">
      {items.map((c) => (
        <li
          key={`${c.cluster_type}-${c.cluster_key}`}
          className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm"
        >
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold capitalize text-zinc-900">
              {c.cluster_key.replace(/_/g, ' ')}
            </span>
            <span className="text-xs text-zinc-500">{c.mention_count} menciones</span>
            <span
              className={`ml-auto rounded-md px-2 py-0.5 text-[10px] font-medium ${
                c.avg_sentimiento < 0
                  ? 'bg-red-100 text-red-700'
                  : c.avg_sentimiento > 0
                    ? 'bg-emerald-100 text-emerald-700'
                    : 'bg-sky-100 text-sky-700'
              }`}
            >
              sent. {Number(c.avg_sentimiento).toFixed(1)}
            </span>
          </div>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-zinc-100">
            <div
              className="h-full rounded-full bg-zinc-900"
              style={{ width: `${(c.mention_count / max) * 100}%` }}
            />
          </div>
          {c.sample_resumen && (
            <p className="mt-2 text-sm text-zinc-600">{c.sample_resumen}</p>
          )}
        </li>
      ))}
    </ul>
  );
}

export function NarrativeClusters({ clusters }: { clusters: Cluster[] }) {
  if (clusters.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-zinc-300 bg-white p-12 text-center">
        <p className="text-sm text-zinc-500">Sin narrativas. Clasifica menciones primero.</p>
      </div>
    );
  }

  const temas = clusters.filter((c) => c.cluster_type === 'tema');
  const etiquetas = clusters.filter((c) => c.cluster_type === 'etiqueta');

  return (
    <div className="space-y-8">
      {temas.length > 0 && (
        <section>
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-zinc-400">
            Por tema
          </h2>
          <ClusterList items={temas} />
        </section>
      )}
      {etiquetas.length > 0 && (
        <section>
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-zinc-400">
            Por etiqueta narrativa
          </h2>
          <ClusterList items={etiquetas} />
        </section>
      )}
    </div>
  );
}
