import { Download } from 'lucide-react';
import { useApi } from '../lib/api';
import { useQuery } from '../lib/router';
import { taka, num, bdToday, STATUS } from '../lib/format';
import { Card, Input, Select, Stat, Spinner, ErrorBox, PageHeader, StatusBadge, Empty } from '../components/ui';
import { SalesChart } from './Dashboard';

function Bars(props: { rows: { label: string; value: number; sub?: string }[] }) {
  const max = Math.max(1, ...props.rows.map((r) => r.value));
  if (!props.rows.length) return <Empty text="No data for this period." />;
  return (
    <ul className="space-y-2.5">
      {props.rows.map((r) => (
        <li key={r.label}>
          <div className="flex justify-between gap-3 text-[13px]"><span className="truncate font-medium capitalize">{r.label}</span><span className="tabular-nums text-muted">{r.sub}</span></div>
          <div className="mt-1 h-2 overflow-hidden rounded-full bg-panel"><div className="h-full rounded-full bg-brand" style={{ width: `${(r.value / max) * 100}%` }} /></div>
        </li>
      ))}
    </ul>
  );
}

export default function Reports() {
  const { get, set } = useQuery();
  const from = get('from') || bdToday(-29), to = get('to') || bdToday(), group = get('group') || 'day';
  const { data: d, error, loading, reload } = useApi(`/reports?from=${from}&to=${to}&group=${group}`);
  const preset = (days: number) => set({ from: bdToday(-(days - 1)), to: bdToday() });
  const s = d?.summary;
  const net = s ? s.gross - s.delivery : 0;
  const days = Math.round((Date.parse(to) - Date.parse(from)) / 86400000) + 1;
  return (
    <>
      <PageHeader title="Reports" sub="Sales exclude cancelled and returned orders."
        actions={<a href={`/admin/api/orders/export?from=${from}&to=${to}`} className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-white px-3.5 py-2 text-[14px] font-medium hover:border-ink/40"><Download size={16} />Export orders</a>} />
      <Card className="mb-4">
        <div className="flex flex-wrap items-center gap-2">
          {[[7, '7 days'], [30, '30 days'], [90, '90 days'], [365, '12 months']].map(([n, l]) => <button key={n} onClick={() => preset(n as number)} className="rounded-full border border-line px-3 py-1 text-[13px] hover:border-ink">{l}</button>)}
          <span className="mx-1 text-muted">|</span>
          <Input type="date" value={from} onChange={(e) => set({ from: e.target.value })} className="w-auto" aria-label="From" />
          <span className="text-muted">to</span>
          <Input type="date" value={to} onChange={(e) => set({ to: e.target.value })} className="w-auto" aria-label="To" />
          <Select value={group} onChange={(e) => set({ group: e.target.value })} className="w-auto" aria-label="Group by"><option value="day">Daily</option><option value="month">Monthly</option></Select>
        </div>
      </Card>
      <ErrorBox error={error} onRetry={reload} />
      {loading && !d ? <Spinner /> : d && (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Stat label="Gross sales" value={taka(s.gross)} sub={`${num(s.orders)} orders · ${num(s.units)} items`} />
            <Stat label="Product sales" value={taka(net)} sub={`excl. ${taka(s.delivery)} delivery`} />
            <Stat label="Average order" value={taka(s.orders - s.failed > 0 ? s.gross / (s.orders - s.failed) : 0)} sub={`Discounts given ${taka(s.discount)}`} />
            <Stat label="Delivery success" value={s.delivered + s.failed ? `${Math.round((s.delivered / (s.delivered + s.failed)) * 100)}%` : '—'} sub={`${s.delivered} delivered · ${s.failed} failed`} />
          </div>
          <Card title="Sales over time" className="mt-4"><SalesChart series={d.series} days={group === 'day' && days <= 120 ? days : undefined} /></Card>
          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            <Card title="Top products" pad={false}>
              {d.top.length === 0 ? <Empty text="No sales." /> : (
                <table className="w-full text-[14px]">
                  <thead className="border-b border-line text-left text-[12px] uppercase text-muted"><tr><th className="px-4 py-2 font-medium">Product</th><th className="px-4 py-2 text-right font-medium">Qty</th><th className="px-4 py-2 text-right font-medium">Sales</th></tr></thead>
                  <tbody className="divide-y divide-line">{d.top.map((p: any) => <tr key={`${p.product_id}-${p.name}`}><td className="px-4 py-2">{p.name}</td><td className="px-4 py-2 text-right tabular-nums">{p.qty}</td><td className="px-4 py-2 text-right tabular-nums">{taka(p.sales)}</td></tr>)}</tbody>
                </table>
              )}
            </Card>
            <div className="space-y-4">
              <Card title="Sales by category"><Bars rows={d.byCategory.map((r: any) => ({ label: r.category, value: r.sales, sub: `${taka(r.sales)} · ${r.qty} items` }))} /></Card>
              <Card title="Orders by status">
                <ul className="grid grid-cols-2 gap-2">{Object.keys(STATUS).map((k) => { const r = d.byStatus.find((x: any) => x.status === k); return <li key={k} className="flex items-center justify-between rounded-lg bg-panel px-3 py-2"><StatusBadge status={k} /><span className="tabular-nums">{r?.n || 0}</span></li>; })}</ul>
              </Card>
            </div>
            <Card title="Top districts"><Bars rows={d.byDistrict.map((r: any) => ({ label: r.district, value: r.orders, sub: `${r.orders} orders · ${taka(r.sales)}` }))} /></Card>
            <Card title="Order sources"><Bars rows={d.bySource.map((r: any) => ({ label: r.source === 'web' ? 'Website' : r.source, value: r.orders, sub: `${r.orders} orders · ${taka(r.sales)}` }))} /></Card>
          </div>
        </>
      )}
    </>
  );
}
