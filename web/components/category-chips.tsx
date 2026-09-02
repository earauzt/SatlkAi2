import { ETIQUETA_LABELS } from '@/lib/mention-utils';

export function CategoryChips({ tags }: { tags: string[] }) {
  if (!tags.length) return null;

  return (
    <div className="flex flex-wrap gap-1.5">
      {tags.map((tag) => {
        const meta = ETIQUETA_LABELS[tag] ?? {
          label: tag.replace(/_/g, ' '),
          className: 'bg-zinc-100 text-zinc-700 ring-zinc-200',
        };
        return (
          <span
            key={tag}
            className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ring-1 ring-inset ${meta.className}`}
          >
            {meta.label}
          </span>
        );
      })}
    </div>
  );
}
