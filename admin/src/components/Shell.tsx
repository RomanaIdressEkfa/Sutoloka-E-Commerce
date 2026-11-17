import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import {
  LayoutDashboard, ShoppingBag, PlusCircle, ShoppingCart, Package, FolderTree, Boxes, Zap, TicketPercent, Users, Star, BarChart3,
  Settings, UserCog, Menu, X, LogOut, ExternalLink, KeyRound,
} from 'lucide-react';
import { Link, useRouter } from '../lib/router';
import { api } from '../lib/api';
import { cx } from './ui';

export type Me = { user: { id: number; name: string; email: string; role: 'owner' | 'manager' | 'staff' }; storeUrl: string };
export const MeCtx = createContext<Me>(null as any);
export const useMe = () => useContext(MeCtx);
export const canManage = (me: Me) => me.user.role !== 'staff';

type NavItem = { to: string; label: string; icon: any; badge?: number; min?: 'manager' | 'owner' };

export function Shell(props: { me: Me; children: ReactNode; onLogout: () => void }) {
  const { loc } = useRouter();
  const [open, setOpen] = useState(false);
  const [counts, setCounts] = useState<{ pending?: number; reviews?: number; abandoned?: number }>({});
  useEffect(() => { setOpen(false); }, [loc.path]);
  useEffect(() => {
    let alive = true;
    const load = () => api('/dashboard?days=7').then((d) => alive && setCounts({ pending: d.kpi.pending, reviews: d.pendingReviews, abandoned: d.abandoned })).catch(() => {});
    load();
    const t = setInterval(load, 60_000);
    return () => { alive = false; clearInterval(t); };
  }, []);
  const role = props.me.user.role;
  const allowed = (i: NavItem) => !i.min || (i.min === 'manager' ? role !== 'staff' : role === 'owner');
  const groups: [string, NavItem[]][] = [
    ['', [{ to: '/', label: 'Dashboard', icon: LayoutDashboard }]],
    ['Sales', [
      { to: '/orders', label: 'Orders', icon: ShoppingBag, badge: counts.pending },
      { to: '/orders/new', label: 'New order', icon: PlusCircle },
      { to: '/abandoned', label: 'Follow-ups', icon: ShoppingCart, badge: counts.abandoned },
    ]],
    ['Catalogue', [
      { to: '/products', label: 'Products', icon: Package },
      { to: '/categories', label: 'Categories', icon: FolderTree },
      { to: '/inventory', label: 'Inventory', icon: Boxes },
      { to: '/flash-sales', label: 'Flash sales', icon: Zap },
      { to: '/coupons', label: 'Coupons', icon: TicketPercent },
    ]],
    ['Customers', [
      { to: '/customers', label: 'Customers', icon: Users },
      { to: '/reviews', label: 'Reviews', icon: Star, badge: counts.reviews },
    ]],
    ['Insights', [{ to: '/reports', label: 'Reports', icon: BarChart3, min: 'manager' }]],
    ['Admin', [
      { to: '/settings', label: 'Settings', icon: Settings, min: 'manager' },
      { to: '/staff', label: 'Staff & roles', icon: UserCog, min: 'owner' },
      { to: '/account', label: 'My password', icon: KeyRound },
    ]],
  ];
  const isActive = (to: string) => (to === '/' ? loc.path === '/' : loc.path === to || (loc.path.startsWith(to + '/') && !(to === '/orders' && loc.path === '/orders/new')));
  const nav = (
    <nav className="admin-scroll flex-1 space-y-6 overflow-y-auto px-3 py-5" aria-label="Admin">
      {groups.map(([g, items]) => {
        const vis = items.filter(allowed);
        if (!vis.length) return null;
        return (
          <div key={g || 'main'}>
            {g && <p className="mb-2 px-3 text-[11.5px] font-semibold uppercase tracking-[0.12em] text-white/40">{g}</p>}
            {vis.map((i) => (
              <Link key={i.to} to={i.to} className={cx('relative mb-0.5 flex items-center gap-3 rounded-lg px-3 py-2.5 text-[15px] font-medium transition', isActive(i.to) ? 'bg-white/10 text-white before:absolute before:inset-y-2 before:-left-3 before:w-1 before:rounded-r before:bg-brand' : 'text-white/65 hover:bg-white/5 hover:text-white')}>
                <i.icon size={20} strokeWidth={1.8} />
                <span className="flex-1 truncate whitespace-nowrap">{i.label}</span>
                {!!i.badge && <span className="min-w-6 rounded-full bg-brand px-2 text-center text-[12px] font-semibold leading-6 text-white">{i.badge}</span>}
              </Link>
            ))}
          </div>
        );
      })}
    </nav>
  );
  const brand = (
    <div className="flex h-16 items-center gap-2.5 border-b border-white/10 px-5">
      <svg width="30" height="30" viewBox="0 0 64 64" aria-hidden="true"><circle cx="24" cy="26" r="13" fill="#b4235a" /><circle cx="40" cy="26" r="13" fill="#f59f00" fillOpacity=".9" /><circle cx="32" cy="40" r="13" fill="#12b886" fillOpacity=".85" /></svg>
      <span className="flex flex-col leading-none"><span className="text-[19px] font-bold text-white">Sutoloka</span><span className="mt-1 text-[12.5px] font-medium text-white/60">সুতোলোকা</span></span><span className="rounded-md bg-white/10 px-2 py-0.5 text-[11.5px] font-medium text-white/70">Admin</span>
    </div>
  );
  const footer = (
    <div className="border-t border-white/10 p-3">
      <div className="flex items-center gap-2.5 px-1.5">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-brand text-[15px] font-semibold text-white">{props.me.user.name.slice(0, 1).toUpperCase()}</div>
        <div className="min-w-0 flex-1"><p className="truncate text-[14.5px] font-medium text-white">{props.me.user.name}</p><p className="text-[13px] capitalize text-white/50">{props.me.user.role}</p></div>
        <button onClick={props.onLogout} className="rounded-lg p-2 text-white/60 hover:bg-white/10 hover:text-white" aria-label="Sign out" title="Sign out"><LogOut size={19} /></button>
      </div>
    </div>
  );
  return (
    <div className="min-h-screen lg:pl-64">
      <aside className="no-print fixed inset-y-0 left-0 z-30 hidden w-64 flex-col bg-[#18171e] lg:flex">{brand}{nav}{footer}</aside>
      {open && (
        <div className="no-print fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-black/40" onClick={() => setOpen(false)} />
          <aside className="absolute inset-y-0 left-0 flex w-72 flex-col bg-[#18171e]">{brand}<button onClick={() => setOpen(false)} className="absolute right-3 top-4 p-1.5 text-white/70" aria-label="Close menu"><X size={20} /></button>{nav}{footer}</aside>
        </div>
      )}
      <header className="no-print sticky top-0 z-20 flex h-16 items-center gap-3 border-b border-line bg-white/95 px-4 backdrop-blur lg:px-6">
        <button onClick={() => setOpen(true)} className="-ml-1 rounded-lg p-1.5 lg:hidden" aria-label="Open menu"><Menu size={22} /></button>
        <div className="flex-1" />
        <a href={props.me.storeUrl} target="_blank" rel="noopener" className="flex items-center gap-1.5 rounded-lg border border-line px-3.5 py-2 text-[14px] font-medium text-ink/80 hover:border-ink/30">View store <ExternalLink size={15} /></a>
      </header>
      <main className="w-full px-4 py-5 lg:px-6 lg:py-6">{props.children}</main>
    </div>
  );
}
