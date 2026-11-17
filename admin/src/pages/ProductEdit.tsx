import { useEffect, useState } from 'react';
import { ArrowLeft, Trash2, Plus, Wand2, ExternalLink } from 'lucide-react';
import { api, useApi } from '../lib/api';
import { Link, useRouter } from '../lib/router';
import { Button, Card, Field, Input, Select, Textarea, Toggle, ImageInput, Spinner, ErrorBox, Confirm, useToast } from '../components/ui';
import { useMe, canManage } from '../components/Shell';

type V = { id?: number; sku: string; color: string; size: string; option: string; price: number; sale_price: number; stock: number; images: string[]; status: string };
const blank = { name: '', slug: '', category_id: '', extra_categories: [] as number[], description: '', thumbnail: '', status: 'active', featured: false, seo_title: '', images: [] as string[], variants: [] as V[] };

export default function ProductEdit(props: { id: string | null }) {
  const me = useMe();
  const editable = canManage(me);
  const toast = useToast();
  const { navigate } = useRouter();
  const isNew = props.id === null;
  const { data, error, loading } = useApi(isNew ? null : `/products/${props.id}`);
  const { data: cats } = useApi<any[]>('/categories');
  const [p, setP] = useState<typeof blank | null>(isNew ? { ...blank, variants: [] } : null);
  const [gen, setGen] = useState({ colors: '', sizes: 'S, M, L, XL', price: '', sale: '', stock: '10' });
  const [busy, setBusy] = useState(false);
  const [archive, setArchive] = useState(false);

  useEffect(() => {
    if (!data) return;
    const imgs = [...new Set([data.thumbnail, ...data.variants.flatMap((v: any) => v.images)].filter(Boolean))] as string[];
    setP({ ...data, category_id: data.category_id ? String(data.category_id) : '', featured: !!data.featured, seo_title: data.seo_title || '', images: imgs, variants: data.variants });
  }, [data]);

  if (error) return <ErrorBox error={error} />;
  if (loading || !p) return <Spinner />;
  const up = (patch: Partial<typeof blank>) => setP({ ...p, ...patch });
  const setV = (i: number, patch: Partial<V>) => up({ variants: p.variants.map((v, k) => (k === i ? { ...v, ...patch } : v)) });

  const generate = () => {
    const colors = gen.colors.split(',').map((s) => s.trim()).filter(Boolean);
    const sizes = gen.sizes.split(',').map((s) => s.trim()).filter(Boolean);
    const price = Number(gen.price), sale = Number(gen.sale) || price, stock = Number(gen.stock) || 0;
    if (!price) { toast('Enter a price first', 'err'); return; }
    const combos = (colors.length ? colors : ['']).flatMap((c) => (sizes.length ? sizes : ['']).map((s) => [c, s]));
    const existing = new Set(p.variants.map((v) => `${v.color}|${v.size}`));
    const add = combos.filter(([c, s]) => !existing.has(`${c}|${s}`)).map(([color, size]) => ({ sku: '', color, size, option: '', price, sale_price: Math.min(sale, price), stock, images: [], status: 'active' }));
    up({ variants: [...p.variants, ...add] });
    toast(`${add.length} variants added`);
  };

  const save = async () => {
    setBusy(true);
    try {
      // Variant galleries: a colour's own images first, then the shared product images
      const body = {
        ...p, thumbnail: p.images[0] || p.thumbnail || null, category_id: p.category_id ? Number(p.category_id) : null,
        variants: p.variants.map((v) => ({ ...v, images: colors.length > 1 && v.images?.length ? v.images : p.images })),
      };
      const r = await api(isNew ? '/products' : `/products/${props.id}`, { method: isNew ? 'POST' : 'PUT', body });
      toast('Product saved');
      if (isNew) navigate(`/products/${r.id}`, true);
    } catch (e: any) { toast(e.message, 'err'); }
    setBusy(false);
  };

  const colorImages = (color: string) => p.variants.find((v) => v.color === color && v.images?.length)?.images || [];
  const setColorImages = (color: string, imgs: string[]) => up({ variants: p.variants.map((v) => (v.color === color ? { ...v, images: imgs } : v)) });
  const colors = [...new Set(p.variants.map((v) => v.color).filter(Boolean))];
  const totalStock = p.variants.reduce((s, v) => s + (Number(v.stock) || 0), 0);

  return (
    <>
      <Link to="/products" className="mb-2 inline-flex items-center gap-1 text-[13px] font-medium text-muted hover:text-ink"><ArrowLeft size={14} />Products</Link>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-[22px]">{isNew ? 'Add product' : p.name}</h1>
        <div className="flex gap-2">
          {!isNew && (data as any)?.status === 'active' && <a href={`${me.storeUrl}/product/${(data as any).slug}`} target="_blank" rel="noopener" className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-white px-3.5 py-2 text-[14px] font-medium"><ExternalLink size={15} />View</a>}
          {!isNew && editable && <Button variant="ghost" onClick={() => setArchive(true)}>Archive</Button>}
          {editable && <Button variant="primary" loading={busy} onClick={save}>Save product</Button>}
        </div>
      </div>
      {!editable && <p className="mb-4 rounded-lg bg-amber-50 px-4 py-2.5 text-amber-900">You can view products. Ask a manager to make changes.</p>}
      <fieldset disabled={!editable} className="grid gap-4 xl:grid-cols-[1fr_340px]">
        <div className="space-y-4">
          <Card title="Details">
            <div className="space-y-3">
              <Field label="Product name *"><Input value={p.name} onChange={(e) => up({ name: e.target.value })} placeholder="e.g. Jamdani Cotton Saree" /></Field>
              <Field label="Description" hint="Fabric, fit, care instructions. Blank lines start new paragraphs."><Textarea rows={6} value={p.description} onChange={(e) => up({ description: e.target.value })} /></Field>
            </div>
          </Card>
          <Card title="Photos" actions={<span className="text-[12px] text-muted">First photo is the main image · JPG/PNG/WebP up to 5 MB</span>}>
            <ImageInput value={p.images} onChange={(images) => up({ images })} max={10} />
          </Card>
          <Card title={`Variants (${p.variants.length}) · ${totalStock} in stock`}>
            <div className="mb-4 grid gap-2 rounded-lg bg-panel p-3 sm:grid-cols-[1.4fr_1.4fr_repeat(3,0.8fr)_auto]">
              <Field label="Colours"><Input value={gen.colors} onChange={(e) => setGen({ ...gen, colors: e.target.value })} placeholder="Maroon, Navy" /></Field>
              <Field label="Sizes"><Input value={gen.sizes} onChange={(e) => setGen({ ...gen, sizes: e.target.value })} placeholder="S, M, L" /></Field>
              <Field label="Price ৳"><Input type="number" value={gen.price} onChange={(e) => setGen({ ...gen, price: e.target.value })} /></Field>
              <Field label="Sale ৳"><Input type="number" value={gen.sale} onChange={(e) => setGen({ ...gen, sale: e.target.value })} placeholder="optional" /></Field>
              <Field label="Stock each"><Input type="number" value={gen.stock} onChange={(e) => setGen({ ...gen, stock: e.target.value })} /></Field>
              <div className="flex items-end"><Button type="button" icon={<Wand2 size={15} />} onClick={generate}>Generate</Button></div>
            </div>
            {p.variants.length === 0 ? <p className="py-4 text-center text-muted">Enter colours, sizes and a price above, then press Generate.</p> : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[720px] text-[14px]">
                  <thead className="text-left text-[12px] uppercase tracking-wide text-muted"><tr><th className="pb-2">Colour</th><th className="pb-2">Size</th><th className="pb-2">SKU</th><th className="pb-2">Price ৳</th><th className="pb-2">Sale ৳</th><th className="pb-2">Stock</th><th className="pb-2">Active</th><th /></tr></thead>
                  <tbody>
                    {p.variants.map((v, i) => (
                      <tr key={v.id ?? `n${i}`} className="border-t border-line">
                        <td className="py-1.5 pr-2"><Input value={v.color} onChange={(e) => setV(i, { color: e.target.value })} className="py-1.5" aria-label="Colour" /></td>
                        <td className="py-1.5 pr-2"><Input value={v.size} onChange={(e) => setV(i, { size: e.target.value })} className="w-24 py-1.5" aria-label="Size" /></td>
                        <td className="py-1.5 pr-2"><Input value={v.sku} onChange={(e) => setV(i, { sku: e.target.value })} placeholder="auto" className="py-1.5" aria-label="SKU" /></td>
                        <td className="py-1.5 pr-2"><Input type="number" value={v.price} onChange={(e) => setV(i, { price: Number(e.target.value) })} className="w-24 py-1.5" aria-label="Price" /></td>
                        <td className="py-1.5 pr-2"><Input type="number" value={v.sale_price} onChange={(e) => setV(i, { sale_price: Number(e.target.value) })} className="w-24 py-1.5" aria-label="Sale price" /></td>
                        <td className="py-1.5 pr-2"><Input type="number" min={0} value={v.stock} onChange={(e) => setV(i, { stock: Number(e.target.value) })} className="w-20 py-1.5" aria-label="Stock" /></td>
                        <td className="py-1.5 pr-2"><Toggle checked={v.status !== 'inactive'} onChange={(on) => setV(i, { status: on ? 'active' : 'inactive' })} /></td>
                        <td className="py-1.5"><button type="button" onClick={() => up({ variants: p.variants.filter((_, k) => k !== i) })} className="rounded-lg p-2 text-muted hover:bg-red-50 hover:text-red-600" aria-label="Delete variant"><Trash2 size={15} /></button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <Button type="button" size="sm" className="mt-2" icon={<Plus size={14} />} onClick={() => up({ variants: [...p.variants, { sku: '', color: '', size: '', option: '', price: p.variants[0]?.price || 0, sale_price: p.variants[0]?.sale_price || 0, stock: 0, images: [], status: 'active' }] })}>Add variant</Button>
              </div>
            )}
          </Card>
          {colors.length > 1 && (
            <Card title="Photos per colour" actions={<span className="text-[12px] text-muted">Optional — shown when a shopper picks that colour</span>}>
              <div className="space-y-4">{colors.map((c) => <div key={c}><p className="mb-1.5 font-medium">{c}</p><ImageInput value={colorImages(c)} onChange={(imgs) => setColorImages(c, imgs)} max={6} /></div>)}</div>
            </Card>
          )}
        </div>
        <div className="space-y-4">
          <Card title="Status">
            <div className="space-y-3">
              <Field label="Visibility"><Select value={p.status} onChange={(e) => up({ status: e.target.value })}><option value="active">Active — visible in store</option><option value="draft">Draft — hidden</option><option value="archived">Archived</option></Select></Field>
              <Toggle checked={p.featured} onChange={(featured) => up({ featured })} label="Featured product" />
            </div>
          </Card>
          <Card title="Organisation">
            <div className="space-y-3">
              <Field label="Main category"><Select value={p.category_id} onChange={(e) => up({ category_id: e.target.value })}><option value="">— none —</option>{(cats || []).map((c) => <option key={c.id} value={c.id}>{c.parent_id ? '— ' : ''}{c.name}</option>)}</Select></Field>
              <Field label="Also show in" hint="Hold Ctrl/Cmd to pick several">
                <select multiple className="input h-32" value={p.extra_categories.map(String)} onChange={(e) => up({ extra_categories: [...e.target.selectedOptions].map((o) => Number(o.value)) })}>
                  {(cats || []).filter((c) => String(c.id) !== p.category_id).map((c) => <option key={c.id} value={c.id}>{c.parent_id ? '— ' : ''}{c.name}</option>)}
                </select>
              </Field>
            </div>
          </Card>
          <Card title="Search engines">
            <div className="space-y-3">
              <Field label="URL slug" hint="Left blank = made from the name"><Input value={p.slug} onChange={(e) => up({ slug: e.target.value })} placeholder="jamdani-cotton-saree" /></Field>
              <Field label="SEO title"><Input value={p.seo_title} onChange={(e) => up({ seo_title: e.target.value })} placeholder={p.name} /></Field>
            </div>
          </Card>
        </div>
      </fieldset>
      <Confirm open={archive} onClose={() => setArchive(false)} title="Archive this product?" danger confirm="Archive"
        text="It disappears from the store but stays in past orders and reports. You can restore it by setting it to Active."
        onConfirm={async () => { await api(`/products/${props.id}`, { method: 'DELETE' }); toast('Product archived'); navigate('/products'); }} />
    </>
  );
}
