import { useState } from 'react';
import { Plus, Search, ExternalLink } from 'lucide-react';
import { useApi } from '../lib/api';
import { Link, useQuery } from '../lib/router';
import { taka, num, date } from '../lib/format';
import { Card, Input, Select, Table, Pagination, ErrorBox, PageHeader, Badge } from '../components/ui';
import { useMe, canManage } from '../components/Shell';

export default function Products() {
  const me = useMe();
  const { q, get, set } = useQuery();
  const [search, setSearch] = useState(get('q'));
  const { data, error, loading, reload } = useApi(`/products?${q.toString()}`);
  const { data: cats } = useApi<any[]>('/categories');
  const rows: any[] = data?.rows || [];
  return (
    <>
      <PageHeader title="Products" sub={data ? `${num(data.total)} products` : ' '}
        actions={canManage(me) && <Link to="/products/new" className="inline-flex items-center gap-1.5 rounded-lg bg-ink px-3.5 py-2 text-[14px] font-medium text-white hover:bg-black"><Plus size={16} />Add product</Link>} />
      <Card pad={false}>
        <div className="flex flex-wrap gap-2 border-b border-line p-3">
          <form className="relative min-w-56 flex-1" onSubmit={(e) => { e.preventDefault(); set({ q: search }); }}>
            <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search name or SKU" className="pl-9" aria-label="Search products" />
          </form>
          <Select value={get('category')} onChange={(e) => set({ category: e.target.value })} className="w-auto" aria-label="Category">
            <option value="">All categories</option>
            {(cats || []).map((c) => <option key={c.id} value={c.id}>{c.parent_id ? '— ' : ''}{c.name}</option>)}
          </Select>
          <Select value={get('status')} onChange={(e) => set({ status: e.target.value })} className="w-auto" aria-label="Status">
            <option value="">Active & draft</option><option value="active">Active</option><option value="draft">Draft</option><option value="archived">Archived</option>
          </Select>
          <Select value={get('stock')} onChange={(e) => set({ stock: e.target.value })} className="w-auto" aria-label="Stock">
            <option value="">Any stock</option><option value="low">Low stock</option><option value="out">Out of stock</option>
          </Select>
          <Select value={get('sort') || 'new'} onChange={(e) => set({ sort: e.target.value })} className="w-auto" aria-label="Sort">
            <option value="new">Newest</option><option value="updated">Recently updated</option><option value="name">Name</option><option value="price">Price</option><option value="stock">Stock (low first)</option>
          </Select>
        </div>
        <ErrorBox error={error} onRetry={reload} />
        <Table loading={loading && !data} empty={!rows.length} emptyText="No products found." head={['Product', 'Category', 'Price', 'Stock', 'Sold', 'Status', 'Updated', '']}>
          {rows.map((p) => (
            <tr key={p.id} className="hover:bg-panel/50">
              <td className="px-4 py-2.5">
                <Link to={`/products/${p.id}`} className="flex items-center gap-3">
                  {p.thumbnail ? <img src={p.thumbnail} alt="" className="h-20 w-15 rounded-lg object-cover" /> : <span className="h-20 w-15 rounded-lg bg-panel" />}
                  <span><span className="block font-medium hover:text-brand">{p.name}</span><span className="text-[13.5px] text-muted">{p.variant_count} variants{p.featured ? ' · Featured' : ''}</span></span>
                </Link>
              </td>
              <td className="px-4 py-2.5 text-muted">{p.category || '—'}</td>
              <td className="whitespace-nowrap px-4 py-2.5 tabular-nums">{taka(p.min_price)}{p.max_price > p.min_price && ` – ${taka(p.max_price)}`}</td>
              <td className="px-4 py-2.5">{p.total_stock <= 0 ? <Badge tone="red">Out of stock</Badge> : p.total_stock <= 5 ? <Badge tone="amber">{p.total_stock} left</Badge> : <span className="tabular-nums">{p.total_stock}</span>}</td>
              <td className="px-4 py-2.5 tabular-nums">{p.sold}</td>
              <td className="px-4 py-2.5"><Badge tone={p.status === 'active' ? 'green' : p.status === 'draft' ? 'amber' : 'gray'}>{p.status}</Badge></td>
              <td className="whitespace-nowrap px-4 py-2.5 text-[13px] text-muted">{date(p.updated_at)}</td>
              <td className="px-4 py-2.5">{p.status === 'active' && <a href={`${me.storeUrl}/product/${p.slug}`} target="_blank" rel="noopener" className="text-muted hover:text-ink" aria-label="View in store"><ExternalLink size={15} /></a>}</td>
            </tr>
          ))}
        </Table>
        {data && <Pagination page={data.page} pages={data.pages} total={data.total} onPage={(p) => set({ page: p })} />}
      </Card>
    </>
  );
}
