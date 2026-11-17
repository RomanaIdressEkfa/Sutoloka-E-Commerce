import { useEffect, useState } from 'react';
import { ArrowLeft, Phone, MessageCircle } from 'lucide-react';
import { api, useApi } from '../lib/api';
import { Link } from '../lib/router';
import { taka, date, dateTime } from '../lib/format';
import { Button, Card, Field, Input, Textarea, Toggle, StatusBadge, Spinner, ErrorBox, Stat, useToast } from '../components/ui';
import { useMe, canManage } from '../components/Shell';

export default function CustomerDetail(props: { id: string }) {
  const me = useMe();
  const toast = useToast();
  const { data: c, error, loading, reload } = useApi(`/customers/${props.id}`);
  const [notes, setNotes] = useState('');
  const [pts, setPts] = useState(0);
  useEffect(() => { if (c) setNotes(c.notes || ''); }, [c]);
  if (loading && !c) return <Spinner />;
  if (error) return <ErrorBox error={error} onRetry={reload} />;
  if (!c) return null;
  const delivered = c.orders.filter((o: any) => o.status === 'delivered');
  const failed = c.orders.filter((o: any) => ['cancelled', 'returned'].includes(o.status)).length;
  const patch = async (body: any, msg: string) => { try { await api(`/customers/${c.id}`, { method: 'PATCH', body }); toast(msg); reload(); } catch (e: any) { toast(e.message, 'err'); } };
  return (
    <>
      <Link to="/customers" className="mb-2 inline-flex items-center gap-1 text-[13px] font-medium text-muted hover:text-ink"><ArrowLeft size={14} />Customers</Link>
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div><h1 className="text-[22px]">{c.name}</h1><p className="text-muted">{c.phone}{c.email ? ` · ${c.email}` : ''} · customer since {date(c.created_at)}</p></div>
        <div className="flex gap-2">
          <a href={`tel:${c.phone}`} className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-white px-3.5 py-2 font-medium"><Phone size={15} />Call</a>
          <a href={`https://wa.me/88${c.phone}`} target="_blank" rel="noopener" className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-white px-3.5 py-2 font-medium"><MessageCircle size={15} />WhatsApp</a>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Orders" value={c.orders.length} />
        <Stat label="Delivered value" value={taka(delivered.reduce((s: number, o: any) => s + o.total, 0))} />
        <Stat label="Cancelled / returned" value={failed} />
        <Stat label="Reward points" value={c.points} />
      </div>
      <div className="mt-4 grid gap-4 xl:grid-cols-[1fr_340px]">
        <Card title="Orders" pad={false}>
          {c.orders.length === 0 ? <p className="p-4 text-muted">No orders yet.</p> : (
            <ul className="divide-y divide-line">
              {c.orders.map((o: any) => (
                <li key={o.id}><Link to={`/orders/${o.id}`} className="flex items-center gap-3 px-4 py-2.5 hover:bg-panel/60"><span className="flex-1 font-medium">{o.order_no}<span className="block text-[12px] font-normal text-muted">{dateTime(o.created_at)} · {o.items} items</span></span><span className="tabular-nums">{taka(o.total)}</span><StatusBadge status={o.status} /></Link></li>
              ))}
            </ul>
          )}
        </Card>
        <div className="space-y-4">
          <Card title="Address">
            <p>{c.address || '—'}</p><p className="text-muted">{c.district}</p>
          </Card>
          <Card title="Internal notes">
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Only staff can see this" />
            <Button size="sm" className="mt-2" onClick={() => patch({ notes }, 'Notes saved')}>Save notes</Button>
            <div className="mt-4 border-t border-line pt-3"><Toggle checked={!!c.blocked} onChange={(b) => patch({ blocked: b }, b ? 'Customer blocked from online orders' : 'Customer unblocked')} label="Block online orders (fake / repeated returns)" /></div>
          </Card>
          {canManage(me) && (
            <Card title="Reward points">
              <div className="flex gap-2">
                <Field label="Add (+) or remove (−)" className="flex-1"><Input type="number" value={pts} onChange={(e) => setPts(Number(e.target.value))} /></Field>
                <div className="flex items-end"><Button disabled={!pts} onClick={async () => { try { await api(`/customers/${c.id}/points`, { body: { change: pts } }); setPts(0); toast('Points updated'); reload(); } catch (e: any) { toast(e.message, 'err'); } }}>Apply</Button></div>
              </div>
              {c.points_history.length > 0 && (
                <ul className="mt-3 divide-y divide-line text-[13px]">
                  {c.points_history.map((l: any) => <li key={l.id} className="flex justify-between py-1.5"><span className="capitalize">{l.reason}<span className="ml-2 text-muted">{date(l.created_at)}</span></span><span className={l.change > 0 ? 'text-emerald-700' : 'text-red-600'}>{l.change > 0 ? '+' : ''}{l.change}</span></li>)}
                </ul>
              )}
            </Card>
          )}
        </div>
      </div>
    </>
  );
}
