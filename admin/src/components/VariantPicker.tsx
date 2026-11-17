import { useEffect, useState } from 'react';
import { Search } from 'lucide-react';
import { api } from '../lib/api';
import { taka } from '../lib/format';
import { Input } from './ui';

export type PickedVariant = { id: number; sku: string; color: string; size: string; sale_price: number; stock: number; name: string; thumbnail: string | null };

/** Search products/SKUs and pick a variant (size/colour) to add to an order. */
export function VariantPicker(props: { onPick: (v: PickedVariant) => void; autoFocus?: boolean }) {
  const [q, setQ] = useState('');
  const [rows, setRows] = useState<PickedVariant[]>([]);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (q.trim().length < 2) { setRows([]); return; }
    const t = setTimeout(async () => {
      setBusy(true);
      try { setRows(await api(`/variants/search?q=${encodeURIComponent(q.trim())}`)); } catch { setRows([]); }
      setBusy(false);
    }, 200);
    return () => clearTimeout(t);
  }, [q]);
  return (
    <div>
      <div className="relative">
        <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
        <Input autoFocus={props.autoFocus} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search product name or SKU" className="pl-9" aria-label="Search products" />
      </div>
      {(rows.length > 0 || (busy && q.length > 1)) && (
        <ul className="mt-2 max-h-72 divide-y divide-line overflow-y-auto rounded-lg border border-line">
          {busy && !rows.length && <li className="px-3 py-2.5 text-muted">Searching…</li>}
          {rows.map((v) => (
            <li key={v.id}>
              <button type="button" disabled={v.stock <= 0} onClick={() => { props.onPick(v); setQ(''); setRows([]); }}
                className="flex w-full items-center gap-3 px-3 py-2 text-left hover:bg-panel disabled:cursor-not-allowed disabled:opacity-50">
                {v.thumbnail && <img src={v.thumbnail} alt="" className="h-14 w-11 rounded-lg object-cover" />}
                <span className="min-w-0 flex-1"><span className="block truncate font-medium">{v.name}</span><span className="text-[12px] text-muted">{[v.color, v.size].filter(Boolean).join(' · ')} · {v.sku}</span></span>
                <span className="text-right"><span className="block tabular-nums">{taka(v.sale_price)}</span><span className={`text-[12px] ${v.stock <= 0 ? 'text-red-600' : 'text-muted'}`}>{v.stock <= 0 ? 'Out of stock' : `${v.stock} in stock`}</span></span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
