import { splitHighlight } from '@/lib/highlight';

export function HighlightedText({
  text,
  terms,
}: {
  text: string;
  terms: string[];
}) {
  const parts = splitHighlight(text, terms);
  return (
    <>
      {parts.map((part, i) =>
        part.hit ? (
          <mark key={i} className="rounded-sm bg-amber-200/90 px-0.5 text-zinc-900">
            {part.text}
          </mark>
        ) : (
          <span key={i}>{part.text}</span>
        )
      )}
    </>
  );
}
