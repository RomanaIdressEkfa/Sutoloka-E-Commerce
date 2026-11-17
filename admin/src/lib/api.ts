import { useCallback, useEffect, useRef, useState } from 'react';

export class ApiError extends Error { constructor(msg: string, public status: number) { super(msg); } }

let onUnauthorized: () => void = () => {};
export const setUnauthorizedHandler = (fn: () => void) => { onUnauthorized = fn; };

export async function api<T = any>(path: string, opts: { method?: string; body?: unknown; form?: FormData } = {}): Promise<T> {
  const init: RequestInit = { method: opts.method || (opts.body || opts.form ? 'POST' : 'GET'), credentials: 'same-origin' };
  if (opts.form) init.body = opts.form;
  else if (opts.body !== undefined) { init.body = JSON.stringify(opts.body); init.headers = { 'content-type': 'application/json' }; }
  const r = await fetch(`/admin/api${path}`, init);
  const data: any = r.headers.get('content-type')?.includes('json') ? await r.json() : null;
  if (r.status === 401 && !path.startsWith('/auth/')) onUnauthorized();
  if (!r.ok) throw new ApiError(data?.error || `Request failed (${r.status})`, r.status);
  return data as T;
}

/** Loads data for a page; `reload()` re-fetches. Stale responses are ignored. */
export function useApi<T = any>(path: string | null, deps: unknown[] = []) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(!!path);
  const seq = useRef(0);
  const load = useCallback(async () => {
    if (!path) return;
    const my = ++seq.current;
    setLoading(true);
    try {
      const d = await api<T>(path);
      if (my === seq.current) { setData(d); setError(null); }
    } catch (e: any) {
      if (my === seq.current) setError(e.message);
    } finally {
      if (my === seq.current) setLoading(false);
    }
  }, [path]);
  useEffect(() => { load(); }, [load, ...deps]);
  return { data, setData, error, loading, reload: load };
}
