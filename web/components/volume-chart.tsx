'use client';

type Bucket = {
  bucket_start: string;
  mention_count: number;
  avg_sentimiento: number;
};

function barColor(sentimiento: number, count: number) {
  if (count === 0) return 'bg-zinc-100';
  if (sentimiento <= -1) return 'bg-red-400';
  if (sentimiento >= 1) return 'bg-emerald-400';
  return 'bg-sky-400';
}

function formatLabel(iso: string, hourly: boolean) {
  const d = new Date(iso);
  if (hourly) {
    return d.toLocaleString('es-EC', { day: '2-digit', month: 'short', hour: '2-digit' });
  }
  return d.toLocaleDateString('es-EC', { day: '2-digit', month: 'short' });
}

export function VolumeChart({ buckets, rangeHours }: { buckets: Bucket[]; rangeHours: number }) {
  const hourly = rangeHours <= 96;
  const max = Math.max(...buckets.map((b) => b.mention_count), 1);
  const total = buckets.reduce((s, b) => s + b.mention_count, 0);

  return (
    <section>
      <p className="mb-4 text-sm text-zinc-500">
        {total} menciones en {rangeHours <= 96 ? '72 horas' : '30 días'}
      </p>
      <div className="flex h-32 items-end gap-0.5 border-b border-zinc-200 pb-2">
        {buckets.map((b) => {
          const h = Math.max(6, (b.mention_count / max) * 100);
          return (
            <div
              key={b.bucket_start}
              title={`${formatLabel(b.bucket_start, hourly)}: ${b.mention_count}`}
              className={`min-w-[3px] flex-1 rounded-t transition-opacity hover:opacity-80 ${barColor(Number(b.avg_sentimiento), b.mention_count)}`}
              style={{ height: `${h}%` }}
            />
          );
        })}
      </div>
      <div className="mt-2 flex justify-between text-[10px] text-zinc-400">
        <span>{buckets[0] ? formatLabel(buckets[0].bucket_start, hourly) : ''}</span>
        <span>{buckets.at(-1) ? formatLabel(buckets.at(-1)!.bucket_start, hourly) : ''}</span>
      </div>
      <div className="mt-3 flex gap-4 text-xs text-zinc-500">
        <span className="flex items-center gap-1">
          <span className="h-2 w-2 rounded-sm bg-red-400" /> Crítico
        </span>
        <span className="flex items-center gap-1">
          <span className="h-2 w-2 rounded-sm bg-sky-400" /> Neutro
        </span>
        <span className="flex items-center gap-1">
          <span className="h-2 w-2 rounded-sm bg-emerald-400" /> Favorable
        </span>
      </div>
    </section>
  );
}
