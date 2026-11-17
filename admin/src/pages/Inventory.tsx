import { useState } from 'react';
import { Search, History } from 'lucide-react';
import { api, useApi } from '../lib/api';
import { Link, useQuery } from '../lib/router';
import { taka, dateTime } from '../lib/format';
import { Button, Card, Field, Input, Select, Modal, Table, Pagination, ErrorBox, PageHeader, Badge, useToast, cx } from '../components/ui';
import { useMe, canManage } from '../components/Shell';

export default function Inventory() {
  const me = useMe();
  const toast = useToast();
  const { q, get, set } = useQuery();
  const [search, setSearch] = useState(get('q'));
  const { data, error, loading, reload, setData } = useApi(`/inventory?${q.toString()}`);
  const [adj, setAdj] = useState<any>(null);
  const [form, setForm] = useState({ mode: 'add', amount: 0, reason: 'restock', ref: '' });
  const [hist, setHist] = useState<{ v: any; rows: any[] } | null>(null);
  const [busy, setBusy] = useState(false);
  const rows: any[] = data?.rows || [];
  const filter = get('filter');
  const save = async () => {
    setBusy(true);
    try {
      const body = form.mode === 'set' ? { set: form.amount, reason: form.reason, ref: form.ref } : { change: form.mode === 'add' ? form.amount : -form.amount, reason: form.reason, ref: form.ref };
      const r = await api(`/variants/${adj.id}/stock`, { body });
      setData({ ...data, rows: rows.map((x) => (x.id === adj.id ? { ...x, stock: r.stock } : x)) });
      toast('Stock updated'); setAdj(null);
    } catch (e: any) { toast(e.message, 'err'); }
    setBusy(false);
  };
  const showHistory = async (v: any) => setHist({ v, rows: await api(`/variants/${v.id}/movements`) });
  return (
    <>
      <PageHeader title="Inventory" sub="Stock per size and colour. Every change is logged." />
      <div className="mb-3 flex gap-1 border-b border-line">
        {[['', 'All'], ['low', 'Low (1–3)'], ['out', 'Out of stock']].map(([k, l]) => (
          <button key={k} onClick={() => set({ filter: k })} className={cx('-mb-px border-b-2 px-3 py-2 text-[14px] font-medium', filter === k ? 'border-brand text-brand-dark' : 'border-transparent text-muted hover:text-ink')}>{l}</button>
        ))}
      </div>
      <Card pad={false}>
        <form className="relative border-b border-line p-3" onSubmit={(e) => { e.preventDefault(); set({ q: search }); }}>
          <Search size={16} className="pointer-events-none absolute left-6 top-1/2 -translate-y-1/2 text-muted" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search product or SKU" className="pl-9" aria-label="Search inventory" />
        </form>
        <ErrorBox error={error} onRetry={reload} />
        <Table loading={loading && !data} empty={!rows.length} emptyText="Nothing to show." head={['Product', 'Variant', 'SKU', 'Price', 'Stock', '']}>
          {rows.map((v) => (
            <tr key={v.id} className="hover:bg-panel/50">
              <td className="px-4 py-2"><Link to={`/products/${v.product_id}`} className="flex items-center gap-3">{v.thumbnail && <img src={v.thumbnail} alt="" className="h-16 w-12 rounded-lg object-cover" />}<span className="font-medium hover:text-brand">{v.name}</span></Link></td>
              <td className="px-4 py-2">{[v.color, v.size].filter(Boolean).join(' · ') || '—'}</td>
              <td className="px-4 py-2 text-muted">{v.sku}</td>
              <td className="px-4 py-2 tabular-nums">{taka(v.sale_price)}</td>
              <td className="px-4 py-2">{v.stock <= 0 ? <Badge tone="red">0</Badge> : v.stock <= 3 ? <Badge tone="amber">{v.stock}</Badge> : <span className="tabular-nums">{v.stock}</span>}</td>
              <td className="whitespace-nowrap px-4 py-2 text-right">
                <button onClick={() => showHistory(v)} className="rounded-lg p-2 text-muted hover:bg-panel hover:text-ink" aria-label="Stock history"><History size={15} /></button>
                {canManage(me) && <Button size="sm" onClick={() => { setAdj(v); setForm({ mode: 'add', amount: 0, reason: 'restock', ref: '' }); }}>Adjust</Button>}
              </td>
            </tr>
          ))}
        </Table>
        {data && <Pagination page={data.page} pages={data.pages} total={data.total} onPage={(p) => set({ page: p })} />}
      </Card>
      <Modal open={!!adj} onClose={() => setAdj(null)} title={`Adjust stock · ${adj?.name || ''}`} footer={<><Button onClick={() => setAdj(null)}>Cancel</Button><Button variant="primary" loading={busy} onClick={save}>Save</Button></>}>
        {adj && (
          <div className="space-y-3">
            <p className="text-muted">{[adj.color, adj.size].filter(Boolean).join(' · ')} · current stock <strong className="text-ink">{adj.stock}</strong></p>
            <div className="grid grid-cols-3 gap-2">{[['add', 'Add'], ['remove', 'Remove'], ['set', 'Set to']].map(([k, l]) => <button key={k} onClick={() => setForm({ ...form, mode: k, reason: k === 'add' ? 'restock' : k === 'remove' ? 'damage' : 'adjust' })} className={cx('rounded-lg border py-2 font-medium', form.mode === k ? 'border-ink bg-ink text-white' : 'border-line')}>{l}</button>)}</div>
            <Field label="Quantity"><Input type="number" min={0} value={form.amount} onChange={(e) => setForm({ ...form, amount: Math.max(0, Number(e.target.value)) })} /></Field>
            <Field label="Reason"><Select value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })}><option value="restock">New stock arrived</option><option value="return">Customer return</option><option value="damage">Damaged / lost</option><option value="adjust">Stock count correction</option></Select></Field>
            <Field label="Reference (optional)"><Input value={form.ref} onChange={(e) => setForm({ ...form, ref: e.target.value })} placeholder="Supplier invoice, note…" /></Field>
            <p className="text-[13px] text-muted">New stock: <strong className="text-ink">{form.mode === 'set' ? form.amount : Math.max(0, adj.stock + (form.mode === 'add' ? form.amount : -form.amount))}</strong></p>
          </div>
        )}
      </Modal>
      <Modal open={!!hist} onClose={() => setHist(null)} title="Stock history">
        {hist && (hist.rows.length === 0 ? <p className="text-muted">No changes recorded yet.</p> : (
          <ul className="divide-y divide-line">{hist.rows.map((m) => <li key={m.id} className="flex items-center justify-between py-2"><span><span className="capitalize">{m.reason}</span>{m.ref ? <span className="text-muted"> · {m.ref}</span> : null}<span className="block text-[12px] text-muted">{dateTime(m.created_at)}{m.user_name ? ` · ${m.user_name}` : ''}</span></span><span className={cx('font-semibold tabular-nums', m.change > 0 ? 'text-emerald-700' : 'text-red-600')}>{m.change > 0 ? '+' : ''}{m.change}</span></li>)}</ul>
        ))}
      </Modal>
    </>
  );
}
