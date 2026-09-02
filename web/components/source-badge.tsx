import { SOURCE_META } from '@/lib/mention-utils';

export function SourceBadge({ source }: { source: string }) {
  const meta = SOURCE_META[source] ?? {
    label: source,
    className: 'bg-zinc-100 text-zinc-700',
    icon: '·',
  };

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${meta.className}`}
    >
      {meta.icon && meta.icon !== meta.label && <span className="opacity-80">{meta.icon}</span>}
      {meta.label}
    </span>
  );
}
