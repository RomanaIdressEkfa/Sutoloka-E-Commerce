import { createContext, useContext, useEffect, useState, type AnchorHTMLAttributes, type ReactNode } from 'react';

type Loc = { path: string; query: URLSearchParams };
const Ctx = createContext<{ loc: Loc; navigate: (to: string, replace?: boolean) => void }>(null as any);

export const BASE = '/admin';
const read = (): Loc => ({ path: location.pathname.replace(/^\/admin/, '') || '/', query: new URLSearchParams(location.search) });
const full = (to: string) => BASE + (to === '/' ? '' : to.startsWith('/?') ? to.slice(1) : to);

export function Router(props: { children: ReactNode }) {
  const [loc, setLoc] = useState<Loc>(read);
  useEffect(() => {
    const on = () => setLoc(read());
    addEventListener('popstate', on);
    return () => removeEventListener('popstate', on);
  }, []);
  const navigate = (to: string, replace = false) => {
    if (full(to) === location.pathname + location.search) return;
    history[replace ? 'replaceState' : 'pushState'](null, '', full(to) || '/admin');
    setLoc(read());
    if (!replace) scrollTo(0, 0);
  };
  return <Ctx.Provider value={{ loc, navigate }}>{props.children}</Ctx.Provider>;
}

export const useRouter = () => useContext(Ctx);

/** Updates query-string params in place (used by list filters). */
export function useQuery() {
  const { loc, navigate } = useRouter();
  const set = (patch: Record<string, string | number | undefined | null>) => {
    const q = new URLSearchParams(loc.query);
    for (const [k, v] of Object.entries(patch)) { if (v === undefined || v === null || v === '') q.delete(k); else q.set(k, String(v)); }
    if (!('page' in patch)) q.delete('page');
    const s = q.toString();
    navigate(loc.path + (s ? `?${s}` : ''), true);
  };
  return { q: loc.query, get: (k: string) => loc.query.get(k) || '', set };
}

export function Link(props: AnchorHTMLAttributes<HTMLAnchorElement> & { to: string }) {
  const { navigate } = useRouter();
  const { to, onClick, ...rest } = props;
  return (
    <a {...rest} href={full(to)} onClick={(e) => {
      onClick?.(e);
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || props.target) return;
      e.preventDefault();
      navigate(to);
    }} />
  );
}

/** Matches "/orders/:id" style patterns; returns params or null. */
export function match(pattern: string, path: string): Record<string, string> | null {
  const keys: string[] = [];
  const re = new RegExp('^' + pattern.replace(/:[a-z]+/gi, (m) => { keys.push(m.slice(1)); return '([^/]+)'; }) + '/?$');
  const m = path.match(re);
  if (!m) return null;
  return Object.fromEntries(keys.map((k, i) => [k, decodeURIComponent(m[i + 1])]));
}
