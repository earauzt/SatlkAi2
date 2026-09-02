export type TargetSearchParams = { target?: string };

export function resolveTargetId(params: TargetSearchParams): string | null {
  const value = params.target?.trim();
  if (!value || value === 'all') return null;
  return value;
}

export function withTargetQuery(
  path: string,
  targetId: string | null,
  extra?: Record<string, string | undefined>
): string {
  const sp = new URLSearchParams();
  if (targetId) sp.set('target', targetId);
  if (extra) {
    for (const [key, value] of Object.entries(extra)) {
      if (value) sp.set(key, value);
    }
  }
  const query = sp.toString();
  return query ? `${path}?${query}` : path;
}
