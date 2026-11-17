import { useState } from 'react';
import { Banknote, ShoppingBag, Clock, Truck, AlertTriangle, Star, ShoppingCart, Bell } from 'lucide-react';
import { useApi } from '../lib/api';
import { Link } from '../lib/router';
import { taka, num, dateTime, STATUS } from '../lib/format';

const pl = (n: number, one: string, many = one + 's') => `${n} ${n === 1 ? one : many}`;
import { Card, Stat, StatusBadge, Spinner, ErrorBox, Select, PageHeader, Empty } from '../components/ui';
import { useMe } from '../components/Shell';

export function SalesChart(props: { series: { day?: string; period?: string; sales: number; orders: number }[]; days?: number }) {
  // Fill gaps so every day shows (bars for sales, line for order count)
  let rows = props.series.map((r) => ({ key: (r.day || r.period)!, sales: r.sales, orders: r.orders }));
  if (props.days) {
    const m = new Map(rows.map((r) => [r.key, r]));
    rows = Array.from({ length: props.days }, (_, i) => {
      const d = new Date(Date.now() + 6 * 3600_000 - (props.days! - 1 - i) * 86400_000).toISOString().slice(0, 10);
      return m.get(d) || { key: d, sales: 0, orders: 0 };
    });
  }
  const [hover, setHover] = useState<number | null>(null);
  if (!rows.length) return <Empty text="No sales in this period yet." />;
  const W = 720, H = 220, P = 28;
  const maxS = Math.max(1, ...rows.map((r) => r.sales));
  const maxO = Math.max(1, ...rows.map((r) => r.orders));
  const bw = (W - P) / rows.length;
  const h = hover !== null ? rows[hover] : null;
  return (
    <div className="relative">
      <svg viewBox={`0 0 ${W} ${H + 24}`} className="w-full" role="img" aria-label="Sales chart" onMouseLeave={() => setHover(null)}>
        {[0.25, 0.5, 0.75, 1].map((f) => <line key={f} x1={P} x2={W} y1={H - f * (H - 10)} y2={H - f * (H - 10)} stroke="#eee" />)}
        <text x={0} y={14} fontSize="10" fill="#8a8792">{taka(maxS)}</text>
        {rows.map((r, i) => {
          const bh = (r.sales / maxS) * (H - 10);
          return (
            <g key={r.key} onMouseEnter={() => setHover(i)}>
              <rect x={P + i * bw} y={0} width={bw} height={H} fill="transparent" />
              <rect x={P + i * bw + bw * 0.18} y={H - bh} width={bw * 0.64} height={Math.max(bh, r.sales ? 2 : 0)} rx={3} fill={hover === i ? '#8e1a46' : '#b4235a'} opacity={hover === null || hover === i ? 1 : 0.55} />
            </g>
          );
        })}
        <polyline fill="none" stroke="#f59f00" strokeWidth={2} points={rows.map((r, i) => `${P + i * bw + bw / 2},${H - (r.orders / maxO) * (H - 10)}`).join(' ')} />
        {rows.map((r, i) => (rows.length <= 14 || i % Math.ceil(rows.length / 10) === 0) && <text key={r.key} x={P + i * bw + bw / 2} y={H + 16} fontSize="10" textAnchor="middle" fill="#8a8792">{r.key.length === 10 ? r.key.slice(8) + '/' + r.key.slice(5, 7) : r.key}</text>)}
      </svg>
      <div className="mt-1 flex gap-4 text-[12px] text-muted"><span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-brand" />Sales (৳)</span><span className="flex items-center gap-1.5"><span className="h-0.5 w-3 bg-[#f59f00]" />Orders</span></div>
      {h && <div className="pointer-events-none absolute right-0 top-0 rounded-lg border border-line bg-white px-3 py-2 text-[13px] shadow-lg"><p className="font-medium">{h.key}</p><p>{taka(h.sales)} · {h.orders} orders</p></div>}
    </div>
  );
}

export default function Dashboard() {
  const me = useMe();
  const [days, setDays] = useState(30);
  const { data: d, error, loading, reload } = useApi(`/dashboard?days=${days}`);
  if (loading && !d) return <Spinner />;
  if (error) return <ErrorBox error={error} onRetry={reload} />;
  if (!d) return null;
  const k = d.kpi;
  const totalStatus = d.statuses.reduce((s: number, x: any) => s + x.n, 0);
  const alerts = [
    d.kpi.pending > 0 && { to: '/orders?status=pending', icon: Clock, text: `${pl(d.kpi.pending, 'new order')} waiting for a confirmation call`, tone: 'bg-amber-50 text-amber-900' },
    d.pendingReviews > 0 && { to: '/reviews?status=pending', icon: Star, text: `${pl(d.pendingReviews, 'review')} waiting for approval`, tone: 'bg-sky-50 text-sky-900' },
    d.abandoned > 0 && { to: '/abandoned', icon: ShoppingCart, text: `${pl(d.abandoned, 'abandoned checkout')} to follow up`, tone: 'bg-brand-soft text-brand-dark' },
    d.stockAlerts > 0 && { to: '/abandoned?tab=alerts', icon: Bell, text: `${pl(d.stockAlerts, 'item')} with back-in-stock requests`, tone: 'bg-violet-50 text-violet-900' },
    d.lowStock > 0 && { to: '/inventory?filter=low', icon: AlertTriangle, text: `${pl(d.lowStock, 'variant')} running low (3 or fewer left)`, tone: 'bg-red-50 text-red-900' },
  ].filter(Boolean) as any[];
  return (
    <>
      <PageHeader title={`Hello, ${me.user.name.split(' ')[0]}`} sub="Here's what's happening in your store."
        actions={<Select value={days} onChange={(e) => setDays(Number(e.target.value))} className="w-auto" aria-label="Period"><option value={7}>Last 7 days</option><option value={30}>Last 30 days</option><option value={90}>Last 90 days</option></Select>} />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Today's sales" value={taka(k.today_sales)} sub={`${pl(k.today_orders, 'order')} today`} icon={<Banknote size={16} />} tone="bg-emerald-50 text-emerald-700" />
        <Stat label={`Sales · ${days} days`} value={taka(k.period_sales)} sub={pl(k.period_orders, 'order')} icon={<ShoppingBag size={16} />} tone="bg-brand-soft text-brand" />
        <Stat label="Needs action" value={num(k.pending + k.to_ship)} sub={`${k.pending} to confirm · ${k.to_ship} to ship`} icon={<Clock size={16} />} tone="bg-amber-50 text-amber-700" />
        <Stat label="With courier" value={num(k.in_transit)} sub={`${taka(k.cod_pending)} cash to collect`} icon={<Truck size={16} />} tone="bg-violet-50 text-violet-700" />
      </div>

      {alerts.length > 0 && (
        <div className="mt-4 grid gap-2 md:grid-cols-2">
          {alerts.map((a) => <Link key={a.to} to={a.to} className={`flex items-center gap-2.5 rounded-lg px-3.5 py-2.5 text-[14px] font-medium hover:opacity-90 ${a.tone}`}><a.icon size={16} />{a.text}<span className="ml-auto">→</span></Link>)}
        </div>
      )}

      <div className="mt-4 grid gap-4 xl:grid-cols-[1fr_340px]">
        <Card title="Sales overview"><SalesChart series={d.series} days={days} /></Card>
        <Card title="Orders by status">
          {totalStatus === 0 ? <Empty text="No orders in this period." /> : (
            <div className="space-y-2.5">
              {Object.keys(STATUS).map((s) => {
                const n = d.statuses.find((x: any) => x.status === s)?.n || 0;
                return (
                  <Link key={s} to={`/orders?status=${s}`} className="block">
                    <div className="flex items-center justify-between text-[13px]"><StatusBadge status={s} /><span className="tabular-nums text-muted">{n}</span></div>
                    <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-panel"><div className="h-full rounded-full bg-ink/70" style={{ width: `${(n / totalStatus) * 100}%` }} /></div>
                  </Link>
                );
              })}
            </div>
          )}
        </Card>
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-2">
        <Card title="Recent orders" actions={<Link to="/orders" className="text-[13px] font-medium text-brand">View all</Link>} pad={false}>
          {d.recent.length === 0 ? <Empty text="No orders yet." /> : (
            <ul className="divide-y divide-line">
              {d.recent.map((o: any) => (
                <li key={o.id}>
                  <Link to={`/orders/${o.id}`} className="flex items-center gap-3 px-4 py-2.5 hover:bg-panel/60">
                    <div className="min-w-0 flex-1"><p className="font-medium">{o.order_no} · {o.name}</p><p className="text-[12px] text-muted">{o.district} · {dateTime(o.created_at)}</p></div>
                    <span className="tabular-nums">{taka(o.total)}</span><StatusBadge status={o.status} />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>
        <Card title={`Top products · ${days} days`} pad={false}>
          {d.top.length === 0 ? <Empty text="No sales yet." /> : (
            <ul className="divide-y divide-line">
              {d.top.map((p: any, i: number) => (
                <li key={p.product_id ?? i} className="flex items-center gap-3 px-4 py-2.5">
                  <span className="w-5 text-center text-[13px] font-semibold text-muted">{i + 1}</span>
                  {p.image && <img src={p.image} alt="" className="h-14 w-11 rounded-lg object-cover" />}
                  <Link to={`/products/${p.product_id}`} className="min-w-0 flex-1 truncate font-medium hover:underline">{p.name}</Link>
                  <span className="text-[13px] text-muted">{p.qty} sold</span><span className="w-24 text-right tabular-nums">{taka(p.sales)}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </>
  );
}
