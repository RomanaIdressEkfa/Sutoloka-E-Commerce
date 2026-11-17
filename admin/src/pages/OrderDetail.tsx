import { useEffect, useState, type ReactNode } from 'react';
import { ArrowLeft, Printer, Phone, MessageCircle, Truck, RefreshCw, Pencil, Trash2, Plus, Check, ExternalLink } from 'lucide-react';
import { api, useApi } from '../lib/api';
import { Link } from '../lib/router';
import { taka, dateTime, STATUS, ORDER_FLOW, DISTRICTS } from '../lib/format';
import { Button, Card, Field, Input, Select, Textarea, StatusBadge, Spinner, ErrorBox, Badge, Modal, useToast, cx } from '../components/ui';
import { VariantPicker } from '../components/VariantPicker';
import { useMe } from '../components/Shell';

const NEXT: Record<string, [string, string]> = {
  pending: ['confirmed', 'Confirm order'], confirmed: ['processing', 'Mark as packing'], processing: ['shipped', 'Mark as shipped'], shipped: ['delivered', 'Mark as delivered'],
};

export default function OrderDetail(props: { id: string }) {
  const toast = useToast();
  const me = useMe();
  const { data: o, setData, error, loading, reload } = useApi(`/orders/${props.id}`);
  const [busy, setBusy] = useState('');
  const [note, setNote] = useState('');
  const [editInfo, setEditInfo] = useState(false);
  const [editItems, setEditItems] = useState(false);
  const [courierOpen, setCourierOpen] = useState(false);
  const [statusModal, setStatusModal] = useState<string | null>(null);

  if (loading && !o) return <Spinner />;
  if (error) return <ErrorBox error={error} onRetry={reload} />;
  if (!o) return null;

  const run = async (key: string, fn: () => Promise<any>, ok?: string) => {
    setBusy(key);
    try { const r = await fn(); if (r?.order_no) setData(r); if (ok) toast(ok); } catch (e: any) { toast(e.message, 'err'); }
    setBusy('');
  };
  const setStatus = (status: string, why = '') => run('status', () => api(`/orders/${o.id}/status`, { body: { status, note: why } }), `Order ${STATUS[status].label.toLowerCase()}`);
  const next = NEXT[o.status];
  const due = o.total - o.advance_paid;
  const failedRate = o.customer.orders > 1 ? o.customer.failed / o.customer.orders : 0;
  const canEditItems = ['pending', 'confirmed', 'processing'].includes(o.status);
  const waText = encodeURIComponent(`Assalamu alaikum ${o.name.split(' ')[0]}, this is Sutoloka. Your order ${o.order_no} (${taka(due)}, cash on delivery) — shall we confirm it?`);

  return (
    <>
      <div className="no-print">
        <Link to="/orders" className="mb-2 inline-flex items-center gap-1 text-[13px] font-medium text-muted hover:text-ink"><ArrowLeft size={14} />Orders</Link>
        <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex flex-wrap items-center gap-2"><h1 className="text-[22px]">{o.order_no}</h1><StatusBadge status={o.status} />{o.payment_status === 'paid' && <Badge tone="green">Paid</Badge>}{o.payment_status === 'partial' && <Badge tone="amber">Part-paid</Badge>}</div>
            <p className="mt-0.5 text-muted">Placed {dateTime(o.created_at)} · via <span className="capitalize">{o.source}</span></p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button icon={<Printer size={16} />} onClick={() => print()}>Print invoice</Button>
            {!['cancelled', 'returned', 'delivered'].includes(o.status) && <Button variant="ghost" onClick={() => setStatusModal('cancelled')}>Cancel order</Button>}
            {o.status === 'shipped' || o.status === 'delivered' ? <Button variant="ghost" onClick={() => setStatusModal('returned')}>Mark returned</Button> : null}
            {next && <Button variant="primary" icon={<Check size={16} />} loading={busy === 'status'} onClick={() => setStatus(next[0])}>{next[1]}</Button>}
            {['cancelled', 'returned'].includes(o.status) && <Button onClick={() => setStatus('pending', 'reopened')} loading={busy === 'status'}>Reopen order</Button>}
          </div>
        </div>

        <ol className="mb-5 grid grid-cols-5 gap-1.5">
          {ORDER_FLOW.map((s, i) => {
            const idx = ORDER_FLOW.indexOf(o.status);
            return <li key={s}><div className={cx('h-1.5 rounded-full', idx >= i ? 'bg-brand' : 'bg-line')} /><p className={cx('mt-1.5 text-[12px]', idx >= i ? 'font-medium' : 'text-muted')}>{STATUS[s].label}</p></li>;
          })}
        </ol>

        <div className="grid gap-4 xl:grid-cols-[1fr_360px]">
          <div className="space-y-4">
            <Card title={`Items (${o.items.reduce((s: number, i: any) => s + i.qty, 0)})`} actions={canEditItems && !editItems && <Button size="sm" icon={<Pencil size={14} />} onClick={() => setEditItems(true)}>Edit items</Button>} pad={false}>
              {editItems ? <ItemsEditor order={o} onCancel={() => setEditItems(false)} onSaved={(r) => { setData(r); setEditItems(false); toast('Items updated'); }} /> : (
                <ul className="divide-y divide-line">
                  {o.items.map((it: any) => (
                    <li key={it.id} className="flex items-center gap-3 px-4 py-3">
                      {it.image && <img src={it.image} alt="" className="h-24 w-18 rounded-lg object-cover" />}
                      <div className="min-w-0 flex-1">
                        <Link to={`/products/${it.product_id}`} className="font-medium hover:underline">{it.name}</Link>
                        <p className="text-[12px] text-muted">{[it.color, it.size].filter(Boolean).join(' · ')} · {it.sku}{it.current_stock != null && ` · ${it.current_stock} left`}</p>
                      </div>
                      <span className="tabular-nums text-muted">{taka(it.price)} × {it.qty}</span>
                      <span className="w-24 text-right font-medium tabular-nums">{taka(it.total)}</span>
                    </li>
                  ))}
                </ul>
              )}
              <Totals order={o} onSaved={(r) => { setData(r); toast('Order updated'); }} />
            </Card>

            <Card title="Courier" actions={o.tracking_url && <a href={o.tracking_url} target="_blank" rel="noopener" className="inline-flex items-center gap-1 text-[13px] font-medium text-brand">Track <ExternalLink size={13} /></a>}>
              {o.consignment_id ? (
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div><p className="font-medium capitalize">{o.courier}</p><p className="text-[13px] text-muted">Tracking {o.tracking_code} · Status: <span className="font-medium text-ink">{o.courier_status || '—'}</span></p></div>
                  <Button size="sm" icon={<RefreshCw size={14} />} loading={busy === 'refresh'} onClick={() => run('refresh', () => api(`/orders/${o.id}/courier/refresh`, { method: 'POST', body: {} }), 'Courier status updated')}>Refresh status</Button>
                </div>
              ) : (
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <p className="text-muted">{['confirmed', 'processing'].includes(o.status) ? `Ready to book. Cash to collect: ${taka(due)}.` : o.courier ? `Sent with ${o.courier}${o.tracking_code ? ` · ${o.tracking_code}` : ''}` : 'Confirm the order first, then book a courier.'}</p>
                  <Button variant="brand" icon={<Truck size={16} />} disabled={!['confirmed', 'processing'].includes(o.status)} onClick={() => setCourierOpen(true)}>Book courier</Button>
                </div>
              )}
            </Card>

            <Card title="Notes & activity">
              <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); if (note.trim()) run('note', () => api(`/orders/${o.id}/notes`, { body: { message: note } })).then(() => setNote('')); }}>
                <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Add a note (e.g. customer asked for evening delivery)" aria-label="Note" />
                <Button variant="primary" loading={busy === 'note'} disabled={!note.trim()}>Add</Button>
              </form>
              <ol className="mt-4 space-y-3 border-l border-line pl-4">
                {o.events.map((e: any) => (
                  <li key={e.id} className="relative">
                    <span className={cx('absolute -left-[21px] top-1.5 h-2.5 w-2.5 rounded-full ring-4 ring-white', e.type === 'note' ? 'bg-amber-500' : e.type === 'courier' ? 'bg-violet-500' : e.type === 'edit' ? 'bg-sky-500' : 'bg-brand')} />
                    <p className="text-[14px]">{e.message}</p>
                    <p className="text-[12px] text-muted">{dateTime(e.created_at)}{e.user_name ? ` · ${e.user_name}` : ''}</p>
                  </li>
                ))}
              </ol>
            </Card>
          </div>

          <div className="space-y-4">
            <Card title="Customer" actions={<Button size="sm" variant="ghost" icon={<Pencil size={14} />} onClick={() => setEditInfo(true)}>Edit</Button>}>
              <p className="font-medium">{o.name}</p>
              <p className="text-muted">{o.phone}{o.email ? ` · ${o.email}` : ''}</p>
              <div className="mt-3 flex gap-2">
                <a href={`tel:${o.phone}`} className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-line py-2 text-[13px] font-medium hover:border-ink/40"><Phone size={14} />Call</a>
                <a href={`https://wa.me/88${o.phone}?text=${waText}`} target="_blank" rel="noopener" className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-line py-2 text-[13px] font-medium hover:border-ink/40"><MessageCircle size={14} />WhatsApp</a>
              </div>
              <div className="mt-4 border-t border-line pt-3">
                <p className="text-[12px] font-medium uppercase tracking-wide text-muted">Delivery address</p>
                <p className="mt-1">{o.address}{o.area ? `, ${o.area}` : ''}<br />{o.district} · <span className="text-muted">{o.zone.replace('_', ' ')}</span></p>
                {o.note && <p className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-[13px] text-amber-900">“{o.note}”</p>}
              </div>
              <div className="mt-4 grid grid-cols-3 gap-2 border-t border-line pt-3 text-center">
                <div><p className="text-[18px] font-semibold">{o.customer.orders}</p><p className="text-[12px] text-muted">Orders</p></div>
                <div><p className="text-[18px] font-semibold text-emerald-700">{o.customer.delivered}</p><p className="text-[12px] text-muted">Delivered</p></div>
                <div><p className={cx('text-[18px] font-semibold', o.customer.failed ? 'text-red-600' : '')}>{o.customer.failed}</p><p className="text-[12px] text-muted">Failed</p></div>
              </div>
              {failedRate >= 0.5 && <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-[13px] text-red-800">⚠ High return/cancel rate. Consider asking for the delivery charge in advance.</p>}
              {o.customer_id && <Link to={`/customers/${o.customer_id}`} className="mt-3 block text-center text-[13px] font-medium text-brand">View customer profile</Link>}
            </Card>
          </div>
        </div>
      </div>

      <Invoice o={o} />
      <InfoEditor open={editInfo} order={o} onClose={() => setEditInfo(false)} onSaved={(r) => { setData(r); setEditInfo(false); toast('Customer details updated'); }} />
      <CourierModal open={courierOpen} order={o} onClose={() => setCourierOpen(false)} onSaved={(r) => { setData(r); setCourierOpen(false); toast('Courier booked'); }} />
      <StatusReason status={statusModal} onClose={() => setStatusModal(null)} onConfirm={async (why) => { await setStatus(statusModal!, why); setStatusModal(null); }} />
    </>
  );
}

function Totals(props: { order: any; onSaved: (o: any) => void }) {
  const o = props.order;
  const [edit, setEdit] = useState(false);
  const [f, setF] = useState({ delivery_fee: o.delivery_fee, discount: o.discount, advance_paid: o.advance_paid });
  const [busy, setBusy] = useState(false);
  const toast = useToast();
  useEffect(() => setF({ delivery_fee: o.delivery_fee, discount: o.discount, advance_paid: o.advance_paid }), [o.updated_at]);
  const save = async () => {
    setBusy(true);
    try { props.onSaved(await api(`/orders/${o.id}`, { method: 'PATCH', body: f })); setEdit(false); } catch (e: any) { toast(e.message, 'err'); }
    setBusy(false);
  };
  const row = (label: string, value: ReactNode, cls = '') => <div className={cx('flex justify-between', cls)}><dt>{label}</dt><dd className="tabular-nums">{value}</dd></div>;
  return (
    <div className="border-t border-line bg-panel/40 px-4 py-3">
      {edit ? (
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="Delivery charge (৳)"><Input type="number" min={0} value={f.delivery_fee} onChange={(e) => setF({ ...f, delivery_fee: Number(e.target.value) })} /></Field>
          <Field label="Discount (৳)"><Input type="number" min={0} value={f.discount} onChange={(e) => setF({ ...f, discount: Number(e.target.value) })} /></Field>
          <Field label="Advance paid (৳)" hint="bKash/Nagad received"><Input type="number" min={0} value={f.advance_paid} onChange={(e) => setF({ ...f, advance_paid: Number(e.target.value) })} /></Field>
          <div className="flex gap-2 sm:col-span-3"><Button variant="primary" size="sm" loading={busy} onClick={save}>Save</Button><Button size="sm" onClick={() => setEdit(false)}>Cancel</Button></div>
        </div>
      ) : (
        <dl className="ml-auto max-w-xs space-y-1.5 text-[14px]">
          {row('Subtotal', taka(o.subtotal))}
          {o.offer_discount > 0 && row('Bundle offer', `−${taka(o.offer_discount)}`, 'text-emerald-700')}
          {o.discount > 0 && row(`Discount${o.coupon_code ? ` (${o.coupon_code})` : ''}${o.points_used ? ` · ${o.points_used} pts` : ''}`, `−${taka(o.discount)}`, 'text-emerald-700')}
          {row('Delivery', taka(o.delivery_fee))}
          {row('Total', taka(o.total), 'border-t border-line pt-1.5 font-semibold')}
          {o.advance_paid > 0 && row('Advance paid', `−${taka(o.advance_paid)}`, 'text-emerald-700')}
          {row('Cash to collect', taka(o.total - o.advance_paid), 'text-[16px] font-semibold')}
          <div className="pt-1 text-right"><button onClick={() => setEdit(true)} className="text-[13px] font-medium text-brand hover:underline">Edit charges</button></div>
        </dl>
      )}
    </div>
  );
}

function ItemsEditor(props: { order: any; onCancel: () => void; onSaved: (o: any) => void }) {
  const toast = useToast();
  const [items, setItems] = useState<any[]>(props.order.items.map((i: any) => ({ variantId: i.variant_id, qty: i.qty, price: i.price, name: i.name, label: [i.color, i.size].filter(Boolean).join(' · '), image: i.image })));
  const [busy, setBusy] = useState(false);
  const save = async () => {
    setBusy(true);
    try { props.onSaved(await api(`/orders/${props.order.id}/items`, { method: 'PUT', body: { items: items.map((i) => ({ variantId: i.variantId, qty: i.qty, price: i.price })) } })); }
    catch (e: any) { toast(e.message, 'err'); }
    setBusy(false);
  };
  return (
    <div className="space-y-3 p-4">
      {items.map((it, k) => (
        <div key={k} className="flex flex-wrap items-center gap-3 rounded-lg border border-line p-2.5">
          {it.image && <img src={it.image} alt="" className="h-12 w-9 rounded object-cover" />}
          <div className="min-w-0 flex-1"><p className="truncate font-medium">{it.name}</p><p className="text-[12px] text-muted">{it.label}</p></div>
          <Field label="Qty"><Input type="number" min={1} max={50} value={it.qty} onChange={(e) => setItems(items.map((x, i) => i === k ? { ...x, qty: Number(e.target.value) } : x))} className="w-20 py-1.5" /></Field>
          <Field label="Price ৳"><Input type="number" min={0} value={it.price} onChange={(e) => setItems(items.map((x, i) => i === k ? { ...x, price: Number(e.target.value) } : x))} className="w-24 py-1.5" /></Field>
          <button onClick={() => setItems(items.filter((_, i) => i !== k))} className="mt-4 rounded-lg p-2 text-muted hover:bg-red-50 hover:text-red-600" aria-label="Remove item"><Trash2 size={16} /></button>
        </div>
      ))}
      <div className="rounded-lg border border-dashed border-line p-3"><p className="mb-2 flex items-center gap-1.5 text-[13px] font-medium"><Plus size={14} />Add or swap an item (e.g. a different size)</p>
        <VariantPicker onPick={(v) => setItems([...items, { variantId: v.id, qty: 1, price: v.sale_price, name: v.name, label: [v.color, v.size].filter(Boolean).join(' · '), image: v.thumbnail }])} />
      </div>
      <p className="text-[12px] text-muted">Stock is adjusted automatically. Totals are recalculated; the delivery charge stays the same.</p>
      <div className="flex gap-2"><Button variant="primary" loading={busy} disabled={!items.length} onClick={save}>Save items</Button><Button onClick={props.onCancel}>Cancel</Button></div>
    </div>
  );
}

function InfoEditor(props: { open: boolean; order: any; onClose: () => void; onSaved: (o: any) => void }) {
  const o = props.order;
  const toast = useToast();
  const [f, setF] = useState<any>({});
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (props.open) setF({ name: o.name, phone: o.phone, email: o.email || '', address: o.address, area: o.area || '', district: o.district, zone: o.zone, note: o.note || '' }); }, [props.open]);
  const save = async () => {
    setBusy(true);
    try { props.onSaved(await api(`/orders/${o.id}`, { method: 'PATCH', body: f })); } catch (e: any) { toast(e.message, 'err'); }
    setBusy(false);
  };
  return (
    <Modal open={props.open} onClose={props.onClose} title="Edit customer & address" footer={<><Button onClick={props.onClose}>Cancel</Button><Button variant="primary" loading={busy} onClick={save}>Save</Button></>}>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Name"><Input value={f.name || ''} onChange={(e) => setF({ ...f, name: e.target.value })} /></Field>
        <Field label="Mobile"><Input value={f.phone || ''} onChange={(e) => setF({ ...f, phone: e.target.value })} /></Field>
        <Field label="District"><Select value={f.district || ''} onChange={(e) => setF({ ...f, district: e.target.value })}>{DISTRICTS.map((d) => <option key={d}>{d}</option>)}</Select></Field>
        <Field label="Area / Thana"><Input value={f.area || ''} onChange={(e) => setF({ ...f, area: e.target.value })} /></Field>
        {f.district === 'Dhaka' && <Field label="Delivery zone" className="sm:col-span-2"><Select value={f.zone} onChange={(e) => setF({ ...f, zone: e.target.value })}><option value="inside_dhaka">Inside Dhaka city</option><option value="sub_dhaka">Dhaka sub-area</option></Select></Field>}
        <Field label="Address" className="sm:col-span-2"><Textarea value={f.address || ''} onChange={(e) => setF({ ...f, address: e.target.value })} /></Field>
        <Field label="Email" className="sm:col-span-2"><Input value={f.email || ''} onChange={(e) => setF({ ...f, email: e.target.value })} /></Field>
        <Field label="Customer note" className="sm:col-span-2"><Textarea rows={2} value={f.note || ''} onChange={(e) => setF({ ...f, note: e.target.value })} /></Field>
      </div>
    </Modal>
  );
}

function CourierModal(props: { open: boolean; order: any; onClose: () => void; onSaved: (o: any) => void }) {
  const toast = useToast();
  const [courier, setCourier] = useState('steadfast');
  const [manual, setManual] = useState({ courier: 'steadfast', tracking_code: '' });
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const book = async () => {
    setBusy(true);
    try { props.onSaved(await api(`/orders/${props.order.id}/courier`, { body: { courier, note } })); } catch (e: any) { toast(e.message, 'err'); }
    setBusy(false);
  };
  const saveManual = async () => {
    setBusy(true);
    try {
      await api(`/orders/${props.order.id}`, { method: 'PATCH', body: manual });
      props.onSaved(await api(`/orders/${props.order.id}/status`, { body: { status: 'shipped', note: `sent with ${manual.courier}` } }));
    } catch (e: any) { toast(e.message, 'err'); }
    setBusy(false);
  };
  return (
    <Modal open={props.open} onClose={props.onClose} title="Book a courier">
      <div className="space-y-5">
        <div>
          <p className="mb-2 font-medium">Send automatically</p>
          <div className="grid grid-cols-3 gap-2">
            {['steadfast', 'pathao', 'redx'].map((c) => (
              <button key={c} onClick={() => setCourier(c)} className={cx('rounded-lg border py-3 text-[14px] font-medium capitalize', courier === c ? 'border-brand bg-brand-soft text-brand-dark' : 'border-line hover:border-ink/40')}>{c === 'redx' ? 'RedX' : c}</button>
            ))}
          </div>
          <Field label="Note for the rider (optional)" className="mt-3"><Input value={note} onChange={(e) => setNote(e.target.value)} placeholder={props.order.note || 'e.g. call before delivery'} /></Field>
          <p className="mt-2 text-[13px] text-muted">Cash to collect: <strong className="text-ink">{taka(props.order.total - props.order.advance_paid)}</strong>. The order moves to “Shipped”.</p>
          <Button variant="brand" className="mt-3 w-full" loading={busy} onClick={book}>Book with {courier === 'redx' ? 'RedX' : courier[0].toUpperCase() + courier.slice(1)}</Button>
        </div>
        <div className="border-t border-line pt-4">
          <p className="mb-2 font-medium">Or enter a tracking number you booked yourself</p>
          <div className="flex gap-2">
            <Select value={manual.courier} onChange={(e) => setManual({ ...manual, courier: e.target.value })} className="w-36"><option value="steadfast">Steadfast</option><option value="pathao">Pathao</option><option value="redx">RedX</option><option value="sundarban">Sundarban</option><option value="other">Other</option></Select>
            <Input value={manual.tracking_code} onChange={(e) => setManual({ ...manual, tracking_code: e.target.value })} placeholder="Tracking / consignment no." />
          </div>
          <Button className="mt-2 w-full" disabled={!manual.tracking_code.trim()} loading={busy} onClick={saveManual}>Save & mark shipped</Button>
        </div>
      </div>
    </Modal>
  );
}

function StatusReason(props: { status: string | null; onClose: () => void; onConfirm: (why: string) => Promise<void> }) {
  const [why, setWhy] = useState('');
  const [busy, setBusy] = useState(false);
  const reasons = props.status === 'cancelled' ? ['Customer did not answer', 'Customer cancelled', 'Fake / duplicate order', 'Out of stock'] : ['Customer refused at delivery', 'Wrong size', 'Damaged in transit', 'Not reachable'];
  return (
    <Modal open={!!props.status} onClose={props.onClose} title={props.status === 'cancelled' ? 'Cancel this order?' : 'Mark as returned?'}
      footer={<><Button onClick={props.onClose}>Back</Button><Button variant="danger" loading={busy} onClick={async () => { setBusy(true); await props.onConfirm(why); setBusy(false); setWhy(''); }}>{props.status === 'cancelled' ? 'Cancel order' : 'Mark returned'}</Button></>}>
      <p className="mb-3 text-ink/80">Items go back into stock and any reward points used are refunded to the customer.</p>
      <div className="mb-3 flex flex-wrap gap-2">{reasons.map((r) => <button key={r} onClick={() => setWhy(r)} className={cx('rounded-full border px-3 py-1 text-[13px]', why === r ? 'border-ink bg-ink text-white' : 'border-line')}>{r}</button>)}</div>
      <Field label="Reason"><Input value={why} onChange={(e) => setWhy(e.target.value)} placeholder="Optional" /></Field>
    </Modal>
  );
}

function Invoice(props: { o: any }) {
  const o = props.o;
  return (
    <div className="print-only text-[12px] text-black">
      <div className="flex items-start justify-between border-b border-black pb-3">
        <div><p className="text-[20px] font-bold">Sutoloka</p><p>Cash on delivery invoice</p></div>
        <div className="text-right"><p className="text-[16px] font-bold">{o.order_no}</p><p>{dateTime(o.created_at)}</p></div>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-4">
        <div><p className="font-bold">Deliver to</p><p>{o.name}<br />{o.phone}<br />{o.address}{o.area ? `, ${o.area}` : ''}<br />{o.district}</p></div>
        <div className="text-right">{o.courier && <p><strong>Courier:</strong> {o.courier}<br />{o.tracking_code}</p>}{o.note && <p className="mt-1"><strong>Note:</strong> {o.note}</p>}</div>
      </div>
      <table className="mt-4 w-full border-collapse">
        <thead><tr className="border-y border-black text-left"><th className="py-1">Item</th><th>Size/Colour</th><th className="text-right">Qty</th><th className="text-right">Price</th><th className="text-right">Total</th></tr></thead>
        <tbody>{o.items.map((i: any) => <tr key={i.id} className="border-b border-zinc-300"><td className="py-1">{i.name}<br /><span className="text-[10px]">{i.sku}</span></td><td>{[i.color, i.size].filter(Boolean).join(' / ')}</td><td className="text-right">{i.qty}</td><td className="text-right">{taka(i.price)}</td><td className="text-right">{taka(i.total)}</td></tr>)}</tbody>
      </table>
      <div className="ml-auto mt-3 w-1/2 space-y-0.5">
        <p className="flex justify-between"><span>Subtotal</span><span>{taka(o.subtotal)}</span></p>
        {o.offer_discount > 0 && <p className="flex justify-between"><span>Offer</span><span>−{taka(o.offer_discount)}</span></p>}
        {o.discount > 0 && <p className="flex justify-between"><span>Discount</span><span>−{taka(o.discount)}</span></p>}
        <p className="flex justify-between"><span>Delivery</span><span>{taka(o.delivery_fee)}</span></p>
        {o.advance_paid > 0 && <p className="flex justify-between"><span>Advance paid</span><span>−{taka(o.advance_paid)}</span></p>}
        <p className="flex justify-between border-t border-black pt-1 text-[15px] font-bold"><span>Collect (COD)</span><span>{taka(o.total - o.advance_paid)}</span></p>
      </div>
      <p className="mt-6 text-center text-[11px]">Thank you for shopping with Sutoloka · 7-day easy exchange with tags attached</p>
    </div>
  );
}
