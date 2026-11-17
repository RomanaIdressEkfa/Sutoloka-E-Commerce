import { useState } from 'react';
import { Search } from 'lucide-react';
import { useApi } from '../lib/api';
import { Link, useQuery } from '../lib/router';
import { taka, date } from '../lib/format';
import { Card, Input, Select, Table, Pagination, ErrorBox, PageHeader, Badge } from '../components/ui';

export default function Customers() {
  const { q, get, set } = useQuery();
  const [search, setSearch] = useState(get('q'));
  const { data, error, loading, reload } = useApi(`/customers?${q.toString()}`);
  const rows: any[] = data?.rows || [];
  return (
    <>
      <PageHeader title="Customers" sub={data ? `${data.total} customers` : ' '} />
      <Card pad={false}>
        <div className="flex flex-wrap gap-2 border-b border-line p-3">
          <form className="relative min-w-56 flex-1" onSubmit={(e) => { e.preventDefault(); set({ q: search }); }}>
            <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Name, phone or email" className="pl-9" aria-label="Search customers" />
          </form>
          <Select value={get('sort') || 'recent'} onChange={(e) => set({ sort: e.target.value })} className="w-auto" aria-label="Sort">
            <option value="recent">Recent order</option><option value="spent">Top spenders</option><option value="orders">Most orders</option><option value="name">Name</option>
          </Select>
        </div>
        <ErrorBox error={error} onRetry={reload} />
        <Table loading={loading && !data} empty={!rows.length} emptyText="No customers found." head={['Customer', 'District', 'Orders', 'Delivered value', 'Points', 'Last order', '']}>
          {rows.map((c) => (
            <tr key={c.id} className="hover:bg-panel/50">
              <td className="px-4 py-2.5"><Link to={`/customers/${c.id}`} className="font-medium hover:text-brand">{c.name}</Link><p className="text-[12px] text-muted">{c.phone}</p></td>
              <td className="px-4 py-2.5 text-muted">{c.district || '—'}</td>
              <td className="px-4 py-2.5 tabular-nums">{c.orders}{c.failed > 0 && <span className="ml-1.5"><Badge tone="red">{c.failed} failed</Badge></span>}</td>
              <td className="px-4 py-2.5 tabular-nums">{taka(c.spent)}</td>
              <td className="px-4 py-2.5 tabular-nums">{c.points}</td>
              <td className="px-4 py-2.5 text-muted">{c.last_order ? date(c.last_order) : '—'}</td>
              <td className="px-4 py-2.5">{c.blocked ? <Badge tone="red">Blocked</Badge> : c.orders >= 3 ? <Badge tone="brand">Loyal</Badge> : null}</td>
            </tr>
          ))}
        </Table>
        {data && <Pagination page={data.page} pages={data.pages} total={data.total} onPage={(p) => set({ page: p })} />}
      </Card>
    </>
  );
}
