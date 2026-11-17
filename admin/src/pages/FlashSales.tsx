import { useState } from 'react';
import { Plus, Pencil, Trash2, X, Search } from 'lucide-react';
import { api, useApi } from '../lib/api';
import { dateTime, taka } from '../lib/format';
import { Button, Card, Field, Input, Toggle, Modal, Table, ErrorBox, PageHeader, Badge, Confirm, useToast } from '../components/ui';
import { useMe, canManage } from '../components/Shell';

const local = (iso: string) => { const d = new Date(iso); return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16); };

export default function FlashSales() {
  const me = useMe();
  const toast = useToast();
  const { data, error, loading, reload } = useApi<any[]>('/flash-sales');
  const [edit, setEdit] = useState<any>(null);
  const [del, setDel] = useState<any>(null);
  const [busy, setBusy] = useState(false);
  const [q, setQ] = useState('');
  const [found, setFound] = useState<any[]>([]);
  const rows = data || [];
  const state = (f: any) => f.status !== 'active' ? ['Off', 'gray'] : Date.parse(f.ends_at) < Date.now() ? ['Ended', 'gray'] : Date.parse(f.starts_at) > Date.now() ? ['Scheduled', 'blue'] : ['Live', 'green'];
  const open = async (f?: any) => {
    if (!f) { const s = new Date(); setEdit({ title: 'Flash Sale', percent: 20, starts_at: local(s.toISOString()), ends_at: local(new Date(Date.now() + 3 * 86400000).toISOString()), status: 'active', items: [] }); return; }
    const full = await api(`/flash-sales/${f.id}`);
    setEdit({ ...full, starts_at: local(full.starts_at), ends_at: local(full.ends_at) });
  };
  const search = async () => { if (q.trim().length < 2) return; const r = await api(`/products?q=${encodeURIComponent(q)}&status=active&per=20`); setFound(r.rows); };
  const save = async () => {
    setBusy(true);
    try {
      await api(edit.id ? `/flash-sales/${edit.id}` : '/flash-sales', { method: edit.id ? 'PUT' : 'POST', body: { ...edit, starts_at: new Date(edit.starts_at).toISOString(), ends_at: new Date(edit.ends_at).toISOString(), product_ids: edit.items.map((i: any) => i.id) } });
      toast('Flash sale saved'); setEdit(null); reload();
    } catch (e: any) { toast(e.message, 'err'); }
    setBusy(false);
  };
  return (
    <>
      <PageHeader title="Flash sales" sub="Time-limited discounts with a countdown on the store." actions={canManage(me) && <Button variant="primary" icon={<Plus size={16} />} onClick={() => open()}>New flash sale</Button>} />
      <Card pad={false}>
        <ErrorBox error={error} onRetry={reload} />
        <Table loading={loading && !data} empty={!rows.length} emptyText="No flash sales yet." head={['Sale', 'Discount', 'Products', 'Starts', 'Ends', 'Status', '']}>
          {rows.map((f) => { const [l, t] = state(f); return (
            <tr key={f.id} className="hover:bg-panel/50">
              <td className="px-4 py-2.5 font-medium">{f.title}</td>
              <td className="px-4 py-2.5">{f.percent}% off</td>
              <td className="px-4 py-2.5 tabular-nums">{f.products}</td>
              <td className="px-4 py-2.5 text-muted">{dateTime(f.starts_at)}</td>
              <td className="px-4 py-2.5 text-muted">{dateTime(f.ends_at)}</td>
              <td className="px-4 py-2.5"><Badge tone={t as any}>{l}</Badge></td>
              <td className="px-4 py-2.5 text-right">{canManage(me) && <><button onClick={() => open(f)} className="rounded-lg p-2 text-muted hover:bg-panel hover:text-ink" aria-label="Edit"><Pencil size={15} /></button><button onClick={() => setDel(f)} className="rounded-lg p-2 text-muted hover:bg-red-50 hover:text-red-600" aria-label="Delete"><Trash2 size={15} /></button></>}</td>
            </tr>
          ); })}
        </Table>
      </Card>
      <Modal wide open={!!edit} onClose={() => setEdit(null)} title={edit?.id ? 'Edit flash sale' : 'New flash sale'} footer={<><Button onClick={() => setEdit(null)}>Cancel</Button><Button variant="primary" loading={busy} onClick={save}>Save</Button></>}>
        {edit && (
          <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-4">
              <Field label="Title" className="sm:col-span-2"><Input value={edit.title} onChange={(e) => setEdit({ ...edit, title: e.target.value })} /></Field>
              <Field label="Discount %"><Input type="number" min={1} max={90} value={edit.percent} onChange={(e) => setEdit({ ...edit, percent: Number(e.target.value) })} /></Field>
              <div className="flex items-end pb-2"><Toggle checked={edit.status === 'active'} onChange={(on) => setEdit({ ...edit, status: on ? 'active' : 'inactive' })} label="Enabled" /></div>
              <Field label="Starts" className="sm:col-span-2"><Input type="datetime-local" value={edit.starts_at} onChange={(e) => setEdit({ ...edit, starts_at: e.target.value })} /></Field>
              <Field label="Ends" className="sm:col-span-2"><Input type="datetime-local" value={edit.ends_at} onChange={(e) => setEdit({ ...edit, ends_at: e.target.value })} /></Field>
            </div>
            <div>
              <p className="label">Products ({edit.items.length})</p>
              <div className="flex gap-2">
                <div className="relative flex-1"><Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" /><Input value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); search(); } }} placeholder="Search products to add" className="pl-9" /></div>
                <Button onClick={search}>Search</Button>
              </div>
              {found.length > 0 && (
                <ul className="mt-2 max-h-48 divide-y divide-line overflow-y-auto rounded-lg border border-line">
                  {found.map((p) => { const added = edit.items.some((i: any) => i.id === p.id); return (
                    <li key={p.id} className="flex items-center gap-3 px-3 py-1.5">
                      {p.thumbnail && <img src={p.thumbnail} alt="" className="h-14 w-11 rounded-lg object-cover" />}
                      <span className="flex-1 truncate">{p.name}</span><span className="text-muted">{taka(p.min_price)}</span>
                      <Button size="sm" disabled={added} onClick={() => setEdit({ ...edit, items: [...edit.items, p] })}>{added ? 'Added' : 'Add'}</Button>
                    </li>
                  ); })}
                </ul>
              )}
              <div className="mt-3 flex flex-wrap gap-2">
                {edit.items.map((p: any) => (
                  <span key={p.id} className="inline-flex items-center gap-2 rounded-full border border-line py-1 pl-1 pr-2 text-[13px]">
                    {p.thumbnail && <img src={p.thumbnail} alt="" className="h-6 w-6 rounded-full object-cover" />}{p.name}
                    <button onClick={() => setEdit({ ...edit, items: edit.items.filter((i: any) => i.id !== p.id) })} aria-label={`Remove ${p.name}`}><X size={13} /></button>
                  </span>
                ))}
              </div>
            </div>
          </div>
        )}
      </Modal>
      <Confirm open={!!del} onClose={() => setDel(null)} title={`Delete “${del?.title}”?`} danger confirm="Delete" text="Prices return to normal straight away."
        onConfirm={async () => { await api(`/flash-sales/${del.id}`, { method: 'DELETE' }); toast('Flash sale deleted'); setDel(null); reload(); }} />
    </>
  );
}
