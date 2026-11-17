import { Phone, MessageCircle, Send } from 'lucide-react';
import { api, useApi } from '../lib/api';
import { Link, useQuery } from '../lib/router';
import { taka, ago } from '../lib/format';
import { Button, Card, Table, ErrorBox, PageHeader, Badge, useToast, cx } from '../components/ui';
import { useMe, canManage } from '../components/Shell';

export default function Abandoned() {
  const { get, set } = useQuery();
  const tab = get('tab') || 'carts';
  return (
    <>
      <PageHeader title="Follow-ups" sub="Win back shoppers who left at checkout, and tell waiting customers when items are back." />
      <div className="mb-3 flex gap-1 border-b border-line">
        {[['carts', 'Abandoned checkouts'], ['alerts', 'Back-in-stock requests']].map(([k, l]) => (
          <button key={k} onClick={() => set({ tab: k === 'carts' ? '' : k })} className={cx('-mb-px border-b-2 px-3 py-2 text-[14px] font-medium', tab === k ? 'border-brand text-brand-dark' : 'border-transparent text-muted hover:text-ink')}>{l}</button>
        ))}
      </div>
      {tab === 'alerts' ? <Alerts /> : <Carts />}
    </>
  );
}

function Carts() {
  const toast = useToast();
  const { get, set } = useQuery();
  const status = get('status') || 'open';
  const { data, error, loading, reload } = useApi<any[]>(`/abandoned?status=${status}`);
  const mark = async (phone: string, s: string) => { try { await api(`/abandoned/${phone}`, { method: 'PATCH', body: { status: s } }); toast(s === 'contacted' ? 'Marked as contacted' : 'Dismissed'); reload(); } catch (e: any) { toast(e.message, 'err'); } };
  const rows = data || [];
  return (
    <Card pad={false}>
      <div className="flex gap-2 border-b border-line p-3">
        {['open', 'contacted', 'converted', 'dismissed'].map((s) => <button key={s} onClick={() => set({ status: s === 'open' ? '' : s })} className={cx('rounded-full border px-3 py-1 text-[13px] capitalize', status === s ? 'border-ink bg-ink text-white' : 'border-line')}>{s}</button>)}
      </div>
      <ErrorBox error={error} onRetry={reload} />
      <Table loading={loading && !data} empty={!rows.length} emptyText="No abandoned checkouts. Shoppers appear here 30 minutes after entering their phone without ordering." head={['Shopper', 'Cart', 'Value', 'Last seen', '']}>
        {rows.map((d) => {
          const wa = encodeURIComponent(`Assalamu alaikum${d.name ? ` ${d.name.split(' ')[0]}` : ''}! You left ${d.items.length} item(s) in your Sutoloka cart. Need help with size or delivery? We can place the order for you.`);
          return (
            <tr key={d.phone} className="hover:bg-panel/50">
              <td className="px-4 py-2.5"><p className="font-medium">{d.name || 'Unknown'}</p><p className="text-[12px] text-muted">{d.phone}{d.district ? ` · ${d.district}` : ''}</p></td>
              <td className="px-4 py-2.5"><div className="flex -space-x-2">{d.items.slice(0, 4).map((i: any, k: number) => i.image && <img key={k} src={i.image} alt="" title={`${i.name} ${i.size} ×${i.qty}`} className="h-14 w-11 rounded-md border-2 border-white object-cover" />)}</div><p className="mt-1 max-w-xs truncate text-[12px] text-muted">{d.items.map((i: any) => `${i.name} (${i.size}) ×${i.qty}`).join(', ')}</p></td>
              <td className="px-4 py-2.5 tabular-nums">{taka(d.subtotal)}</td>
              <td className="px-4 py-2.5 text-muted">{ago(d.updated_at)}</td>
              <td className="whitespace-nowrap px-4 py-2.5 text-right">
                <a href={`tel:${d.phone}`} className="mr-1 inline-flex rounded-lg p-2 text-muted hover:bg-panel hover:text-ink" aria-label="Call"><Phone size={15} /></a>
                <a href={`https://wa.me/88${d.phone}?text=${wa}`} target="_blank" rel="noopener" className="mr-2 inline-flex rounded-lg p-2 text-muted hover:bg-panel hover:text-ink" aria-label="WhatsApp"><MessageCircle size={15} /></a>
                {d.status === 'open' && <><Button size="sm" onClick={() => mark(d.phone, 'contacted')}>Contacted</Button> <Button size="sm" variant="ghost" onClick={() => mark(d.phone, 'dismissed')}>Dismiss</Button></>}
              </td>
            </tr>
          );
        })}
      </Table>
    </Card>
  );
}

function Alerts() {
  const me = useMe();
  const toast = useToast();
  const { data, error, loading, reload } = useApi('/stock-alerts');
  const rows: any[] = data?.rows || [];
  const notify = async (vid: number) => {
    try { const r = await api(`/stock-alerts/${vid}/notify`, { method: 'POST', body: {} }); toast(`SMS sent to ${r.sent} of ${r.total} customers`); reload(); } catch (e: any) { toast(e.message, 'err'); }
  };
  return (
    <Card pad={false}>
      {data && !data.sms && <p className="border-b border-line bg-amber-50 px-4 py-2.5 text-[13px] text-amber-900">SMS is not set up, so customers can't be notified automatically. Add an SMS provider in Settings → SMS, or call them.</p>}
      <ErrorBox error={error} onRetry={reload} />
      <Table loading={loading && !data} empty={!rows.length} emptyText="No one is waiting for a restock." head={['Product', 'Variant', 'Waiting', 'In stock now', '']}>
        {rows.map((r) => (
          <tr key={r.variant_id} className="hover:bg-panel/50">
            <td className="px-4 py-2.5"><Link to={`/products/${r.product_id}`} className="flex items-center gap-3">{r.thumbnail && <img src={r.thumbnail} alt="" className="h-14 w-11 rounded-lg object-cover" />}<span className="font-medium hover:text-brand">{r.name}</span></Link></td>
            <td className="px-4 py-2.5">{[r.color, r.size].filter(Boolean).join(' · ')}</td>
            <td className="px-4 py-2.5"><Badge tone="brand">{r.waiting} customers</Badge><p className="mt-0.5 text-[12px] text-muted">last {ago(r.last_request)}</p></td>
            <td className="px-4 py-2.5">{r.stock > 0 ? <Badge tone="green">{r.stock}</Badge> : <Badge tone="red">0</Badge>}</td>
            <td className="px-4 py-2.5 text-right">{canManage(me) && <Button size="sm" variant="primary" icon={<Send size={14} />} disabled={r.stock <= 0 || !data.sms} onClick={() => notify(r.variant_id)}>Send SMS</Button>}</td>
          </tr>
        ))}
      </Table>
    </Card>
  );
}
