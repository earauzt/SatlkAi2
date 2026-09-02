/** Parte el texto para resaltar alias/keywords sin solaparse. */
export function splitHighlight(
  text: string,
  terms: string[]
): { text: string; hit: boolean }[] {
  if (!text) return [];
  const cleaned = [
    ...new Set(terms.map((t) => t.trim()).filter((t) => t.length >= 2)),
  ].sort((a, b) => b.length - a.length);
  if (!cleaned.length) return [{ text, hit: false }];

  const escaped = cleaned.map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  const re = new RegExp(`(${escaped.join('|')})`, 'gi');
  const parts: { text: string; hit: boolean }[] = [];
  let last = 0;
  for (const match of text.matchAll(re)) {
    const idx = match.index ?? 0;
    if (idx > last) parts.push({ text: text.slice(last, idx), hit: false });
    parts.push({ text: match[0], hit: true });
    last = idx + match[0].length;
  }
  if (last < text.length) parts.push({ text: text.slice(last), hit: false });
  return parts.length ? parts : [{ text, hit: false }];
}
