import { useState } from 'react';
import { Download, Plus, Search, AlertTriangle, Repeat } from 'lucide-react';
import { api, useApi } from '../lib/api';
import { Link, useQuery } from '../lib/router';
import { taka, dateTime, STATUS } from '../lib/format';
import { Button, Card, Input, Select, StatusBadge, Table, Pagination, ErrorBox, PageHeader, Badge, useToast, cx } from '../components/ui';
import { useMe, canManage } from '../components/Shell';

export default function Orders() {
  const me = useMe();
  const toast = useToast();
  const { q, get, set } = useQuery();
  const [search, setSearch] = useState(get('q'));
  const [picked, setPicked] = useState<number[]>([]);
  const [bulk, setBulk] = useState('');
  const [busy, setBusy] = useState(false);
  const qs = q.toString();
  const { data, error, loading, reload } = useApi(`/orders?${qs}`);
  const status = get('status');
  const rows: any[] = data?.rows || [];
  const allOn = rows.length > 0 && rows.every((r) => picked.includes(r.id));
  const doBulk = async () => {
    if (!bulk || !picked.length) return;
    setBusy(true);
    try {
      const r = await api('/orders/bulk-status', { body: { ids: picked, status: bulk } });
      toast(`${r.changed} orders updated`);
      setPicked([]); setBulk(''); reload();
    } catch (e: any) { toast(e.message, 'err'); }
    setBusy(false);
  };
  const counts = data?.counts || {};
  const tabs = [['', 'All', Object.values(counts).reduce((a: number, b: any) => a + b, 0)], ...Object.entries(STATUS).map(([k, v]) => [k, v.label, counts[k] || 0])] as [string, string, number][];
  return (
    <>
      <PageHeader title="Orders" sub="Confirm by phone, pack, then book a courier."
        actions={<>
          {canManage(me) && <a href={`/admin/api/orders/export?${qs}`} className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-white px-3.5 py-2 text-[14px] font-medium hover:border-ink/40"><Download size={16} />Export CSV</a>}
          <Link to="/orders/new" className="inline-flex items-center gap-1.5 rounded-lg bg-ink px-3.5 py-2 text-[14px] font-medium text-white hover:bg-black"><Plus size={16} />New order</Link>
        </>} />
      <div className="no-scrollbar mb-3 flex gap-1 overflow-x-auto border-b border-line">
        {tabs.map(([k, label, n]) => (
          <button key={k} onClick={() => { set({ status: k }); setPicked([]); }} className={cx('-mb-px whitespace-nowrap border-b-2 px-3 py-2 text-[14px] font-medium', status === k ? 'border-brand text-brand-dark' : 'border-transparent text-muted hover:text-ink')}>
            {label} <span className="ml-1 rounded-full bg-panel px-1.5 text-[12px]">{n}</span>
          </button>
        ))}
      </div>
      <Card pad={false}>
        <div className="flex flex-wrap items-center gap-2 border-b border-line p-3">
          <form className="relative min-w-56 flex-1" onSubmit={(e) => { e.preventDefault(); set({ q: search }); }}>
            <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Order no, name, phone or tracking code" className="pl-9" aria-label="Search orders" />
          </form>
          <Input type="date" value={get('from')} onChange={(e) => set({ from: e.target.value })} className="w-auto" aria-label="From date" />
          <Input type="date" value={get('to')} onChange={(e) => set({ to: e.target.value })} className="w-auto" aria-label="To date" />
          <Select value={get('source')} onChange={(e) => set({ source: e.target.value })} className="w-auto" aria-label="Source">
            <option value="">All sources</option><option value="web">Website</option><option value="phone">Phone</option><option value="facebook">Facebook</option><option value="whatsapp">WhatsApp</option>
          </Select>
        </div>
        {picked.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 border-b border-line bg-brand-soft/60 px-4 py-2.5">
            <span className="text-[14px] font-medium">{picked.length} selected</span>
            <Select value={bulk} onChange={(e) => setBulk(e.target.value)} className="w-auto py-1.5" aria-label="New status">
              <option value="">Change status to…</option>{Object.entries(STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
            </Select>
            <Button size="sm" variant="primary" disabled={!bulk} loading={busy} onClick={doBulk}>Apply</Button>
            <Button size="sm" variant="ghost" onClick={() => setPicked([])}>Clear</Button>
          </div>
        )}
        <ErrorBox error={error} onRetry={reload} />
        <Table loading={loading && !data} empty={!rows.length} emptyText="No orders match these filters."
          head={[<input type="checkbox" aria-label="Select all" checked={allOn} onChange={() => setPicked(allOn ? [] : rows.map((r) => r.id))} className="h-4 w-4 accent-ink" />, 'Order', 'Customer', 'Items', 'Total', 'Status', 'Courier', 'Placed']}>
          {rows.map((o) => (
            <tr key={o.id} className={cx('hover:bg-panel/50', picked.includes(o.id) && 'bg-brand-soft/40')}>
              <td className="px-4 py-2.5"><input type="checkbox" aria-label={`Select ${o.order_no}`} checked={picked.includes(o.id)} onChange={() => setPicked((p) => p.includes(o.id) ? p.filter((x) => x !== o.id) : [...p, o.id])} className="h-4 w-4 accent-ink" /></td>
              <td className="px-4 py-2.5"><Link to={`/orders/${o.id}`} className="font-semibold text-ink hover:text-brand">{o.order_no}</Link><p className="text-[12px] capitalize text-muted">{o.source}</p></td>
              <td className="px-4 py-2.5">
                <p className="font-medium">{o.name}</p>
                <p className="flex flex-wrap items-center gap-1.5 text-[12px] text-muted">{o.phone} · {o.district}
                  {o.customer_orders > 1 && <Badge tone="blue"><Repeat size={11} />{o.customer_orders} orders</Badge>}
                  {o.customer_failed > 0 && <Badge tone="red"><AlertTriangle size={11} />{o.customer_failed} failed</Badge>}
                </p>
              </td>
              <td className="px-4 py-2.5 tabular-nums">{o.items}</td>
              <td className="px-4 py-2.5 tabular-nums font-medium">{taka(o.total)}{o.advance_paid > 0 && <p className="text-[12px] text-emerald-700">Paid {taka(o.advance_paid)}</p>}</td>
              <td className="px-4 py-2.5"><StatusBadge status={o.status} /></td>
              <td className="px-4 py-2.5 text-[13px]">{o.courier ? <><span className="capitalize">{o.courier}</span><p className="text-[12px] text-muted">{o.tracking_code}</p></> : <span className="text-muted">—</span>}</td>
              <td className="whitespace-nowrap px-4 py-2.5 text-[13px] text-muted">{dateTime(o.created_at)}</td>
            </tr>
          ))}
        </Table>
        {data && <Pagination page={data.page} pages={data.pages} total={data.total} onPage={(p) => set({ page: p })} />}
      </Card>
    </>
  );
}
