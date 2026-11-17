import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Trash2 } from 'lucide-react';
import { api, useApi } from '../lib/api';
import { Link, useRouter } from '../lib/router';
import { taka, DISTRICTS } from '../lib/format';
import { Button, Card, Field, Input, Select, Textarea, useToast } from '../components/ui';
import { VariantPicker, type PickedVariant } from '../components/VariantPicker';

type Line = PickedVariant & { qty: number };

export default function NewOrder() {
  const toast = useToast();
  const { navigate } = useRouter();
  const { data: settings } = useApi('/settings');
  const [lines, setLines] = useState<Line[]>([]);
  const [f, setF] = useState({ name: '', phone: '', district: 'Dhaka', zone: 'inside_dhaka', area: '', address: '', note: '', source: 'phone', coupon: '', discount: 0, advance_paid: 0 });
  const [fee, setFee] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [lookup, setLookup] = useState<any>(null);

  const zone = f.district === 'Dhaka' ? f.zone : ['Gazipur', 'Narayanganj'].includes(f.district) ? 'sub_dhaka' : 'outside_dhaka';
  const defaultFee = settings?.delivery?.[zone] ?? (zone === 'inside_dhaka' ? 70 : zone === 'sub_dhaka' ? 100 : 130);
  const subtotal = lines.reduce((s, l) => s + l.sale_price * l.qty, 0);
  const delivery = fee ?? defaultFee;
  const total = Math.max(0, subtotal - f.discount) + delivery;

  // Look up an existing customer by phone to prefill the address
  useEffect(() => {
    const p = f.phone.replace(/\D/g, '').replace(/^88/, '');
    if (!/^01[3-9]\d{8}$/.test(p)) { setLookup(null); return; }
    api(`/customers?q=${p}&per=5`).then((r) => {
      const c = r.rows.find((x: any) => x.phone === p);
      setLookup(c || null);
      if (c && !f.name && !f.address) setF((x) => ({ ...x, name: c.name === 'Subscriber' ? '' : c.name, address: c.address || '', district: c.district || x.district }));
    }).catch(() => {});
  }, [f.phone]);

  const add = (v: PickedVariant) => setLines((ls) => {
    const ex = ls.find((l) => l.id === v.id);
    return ex ? ls.map((l) => (l.id === v.id ? { ...l, qty: Math.min(l.stock, l.qty + 1) } : l)) : [...ls, { ...v, qty: 1 }];
  });
  const submit = async () => {
    setBusy(true);
    try {
      const r = await api('/orders', { body: { ...f, zone, items: lines.map((l) => ({ variantId: l.id, qty: l.qty })), delivery_fee: fee, coupon: f.coupon || undefined } });
      toast(`Order ${r.orderNo} created`);
      navigate(`/orders/${r.id}`);
    } catch (e: any) { toast(e.message, 'err'); }
    setBusy(false);
  };
  const canSubmit = useMemo(() => lines.length > 0 && f.name.trim().length > 1 && f.address.trim().length > 7 && /^(?:\+?88)?01[3-9]\d{8}$/.test(f.phone.replace(/[\s-]/g, '')), [lines, f]);

  return (
    <>
      <Link to="/orders" className="mb-2 inline-flex items-center gap-1 text-[13px] font-medium text-muted hover:text-ink"><ArrowLeft size={14} />Orders</Link>
      <h1 className="mb-5 text-[22px]">New order</h1>
      <div className="grid gap-4 xl:grid-cols-[1fr_380px]">
        <div className="space-y-4">
          <Card title="Products">
            <VariantPicker onPick={add} autoFocus />
            {lines.length > 0 && (
              <ul className="mt-4 divide-y divide-line rounded-lg border border-line">
                {lines.map((l) => (
                  <li key={l.id} className="flex items-center gap-3 p-2.5">
                    {l.thumbnail && <img src={l.thumbnail} alt="" className="h-12 w-9 rounded object-cover" />}
                    <div className="min-w-0 flex-1"><p className="truncate font-medium">{l.name}</p><p className="text-[12px] text-muted">{[l.color, l.size].filter(Boolean).join(' · ')} · {l.stock} in stock</p></div>
                    <Input type="number" min={1} max={l.stock} value={l.qty} onChange={(e) => setLines(lines.map((x) => (x.id === l.id ? { ...x, qty: Math.max(1, Math.min(l.stock, Number(e.target.value))) } : x)))} className="w-20 py-1.5" aria-label="Quantity" />
                    <span className="w-24 text-right tabular-nums">{taka(l.sale_price * l.qty)}</span>
                    <button onClick={() => setLines(lines.filter((x) => x.id !== l.id))} className="rounded-lg p-2 text-muted hover:bg-red-50 hover:text-red-600" aria-label="Remove"><Trash2 size={16} /></button>
                  </li>
                ))}
              </ul>
            )}
          </Card>
          <Card title="Customer">
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Mobile number *" hint={lookup ? `Returning customer · ${lookup.orders} orders${lookup.failed ? ` · ${lookup.failed} failed` : ''}` : undefined}><Input value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} placeholder="01XXXXXXXXX" inputMode="numeric" /></Field>
              <Field label="Name *"><Input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></Field>
              <Field label="District *"><Select value={f.district} onChange={(e) => { setF({ ...f, district: e.target.value }); setFee(null); }}>{DISTRICTS.map((d) => <option key={d}>{d}</option>)}</Select></Field>
              {f.district === 'Dhaka'
                ? <Field label="Zone"><Select value={f.zone} onChange={(e) => { setF({ ...f, zone: e.target.value }); setFee(null); }}><option value="inside_dhaka">Inside Dhaka city</option><option value="sub_dhaka">Dhaka sub-area</option></Select></Field>
                : <Field label="Area / Thana"><Input value={f.area} onChange={(e) => setF({ ...f, area: e.target.value })} /></Field>}
              <Field label="Full address *" className="sm:col-span-2"><Textarea value={f.address} onChange={(e) => setF({ ...f, address: e.target.value })} /></Field>
              <Field label="Order source"><Select value={f.source} onChange={(e) => setF({ ...f, source: e.target.value })}><option value="phone">Phone call</option><option value="facebook">Facebook</option><option value="whatsapp">WhatsApp</option><option value="admin">Showroom / other</option></Select></Field>
              <Field label="Note"><Input value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} /></Field>
            </div>
          </Card>
        </div>
        <Card title="Summary" className="h-fit xl:sticky xl:top-20">
          <dl className="space-y-2">
            <div className="flex justify-between"><dt>Subtotal</dt><dd className="tabular-nums">{taka(subtotal)}</dd></div>
            <div className="flex items-center justify-between gap-3"><dt>Delivery</dt><dd><Input type="number" min={0} value={delivery} onChange={(e) => setFee(Number(e.target.value))} className="w-24 py-1 text-right" aria-label="Delivery charge" /></dd></div>
            <div className="flex items-center justify-between gap-3"><dt>Discount</dt><dd><Input type="number" min={0} value={f.discount} onChange={(e) => setF({ ...f, discount: Math.max(0, Number(e.target.value)) })} className="w-24 py-1 text-right" aria-label="Discount" /></dd></div>
            <div className="flex items-center justify-between gap-3"><dt>Coupon</dt><dd><Input value={f.coupon} onChange={(e) => setF({ ...f, coupon: e.target.value.toUpperCase() })} className="w-32 py-1 text-right uppercase" aria-label="Coupon" /></dd></div>
            <div className="flex items-center justify-between gap-3"><dt>Advance paid</dt><dd><Input type="number" min={0} value={f.advance_paid} onChange={(e) => setF({ ...f, advance_paid: Math.max(0, Number(e.target.value)) })} className="w-24 py-1 text-right" aria-label="Advance paid" /></dd></div>
            <div className="flex justify-between border-t border-line pt-2 text-[16px] font-semibold"><dt>Total</dt><dd className="tabular-nums">{taka(total)}</dd></div>
            <div className="flex justify-between text-muted"><dt>Cash to collect</dt><dd className="tabular-nums">{taka(Math.max(0, total - f.advance_paid))}</dd></div>
          </dl>
          <p className="mt-2 text-[12px] text-muted">Bundle offers and coupons are applied by the server; the final total appears on the order.</p>
          <Button variant="primary" className="mt-4 w-full py-2.5" disabled={!canSubmit} loading={busy} onClick={submit}>Create confirmed order</Button>
        </Card>
      </div>
    </>
  );
}
