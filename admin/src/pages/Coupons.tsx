import { useState } from 'react';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import { api, useApi } from '../lib/api';
import { taka, date } from '../lib/format';
import { Button, Card, Field, Input, Select, Toggle, Modal, Table, ErrorBox, PageHeader, Badge, Confirm, useToast } from '../components/ui';
import { useMe, canManage } from '../components/Shell';

const empty = { id: 0, code: '', type: 'percent', value: 10, min_order: 0, max_discount: '', starts_at: '', ends_at: '', usage_limit: '', status: 'active' };
const toLocal = (iso: string) => { const d = new Date(iso); return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16); };
const describe = (c: any) => c.type === 'percent' ? `${c.value}% off${c.max_discount ? ` (max ${taka(c.max_discount)})` : ''}` : c.type === 'fixed' ? `${taka(c.value)} off` : 'Free delivery';

export default function Coupons() {
  const me = useMe();
  const toast = useToast();
  const { data, error, loading, reload } = useApi<any[]>('/coupons');
  const [edit, setEdit] = useState<any>(null);
  const [del, setDel] = useState<any>(null);
  const [busy, setBusy] = useState(false);
  const rows = data || [];
  const save = async () => {
    setBusy(true);
    try {
      await api(edit.id ? `/coupons/${edit.id}` : '/coupons', { method: edit.id ? 'PUT' : 'POST', body: { ...edit, starts_at: edit.starts_at ? new Date(edit.starts_at).toISOString() : null, ends_at: edit.ends_at ? new Date(edit.ends_at).toISOString() : null } });
      toast('Coupon saved'); setEdit(null); reload();
    } catch (e: any) { toast(e.message, 'err'); }
    setBusy(false);
  };
  const expired = (c: any) => c.ends_at && Date.parse(c.ends_at) < Date.now();
  return (
    <>
      <PageHeader title="Coupons" sub="Discount codes customers enter at checkout." actions={canManage(me) && <Button variant="primary" icon={<Plus size={16} />} onClick={() => setEdit({ ...empty })}>Create coupon</Button>} />
      <Card pad={false}>
        <ErrorBox error={error} onRetry={reload} />
        <Table loading={loading && !data} empty={!rows.length} emptyText="No coupons yet." head={['Code', 'Discount', 'Minimum order', 'Used', 'Valid until', 'Status', '']}>
          {rows.map((c) => (
            <tr key={c.id} className="hover:bg-panel/50">
              <td className="px-4 py-2.5 font-mono font-semibold">{c.code}</td>
              <td className="px-4 py-2.5">{describe(c)}</td>
              <td className="px-4 py-2.5 tabular-nums">{c.min_order ? taka(c.min_order) : '—'}</td>
              <td className="px-4 py-2.5 tabular-nums">{c.used}{c.usage_limit ? ` / ${c.usage_limit}` : ''}</td>
              <td className="px-4 py-2.5 text-muted">{c.ends_at ? date(c.ends_at) : 'No end date'}</td>
              <td className="px-4 py-2.5">{expired(c) ? <Badge>Expired</Badge> : <Badge tone={c.status === 'active' ? 'green' : 'gray'}>{c.status}</Badge>}</td>
              <td className="px-4 py-2.5 text-right">{canManage(me) && <><button onClick={() => setEdit({ ...c, max_discount: c.max_discount ?? '', usage_limit: c.usage_limit ?? '', starts_at: c.starts_at ? toLocal(c.starts_at) : '', ends_at: c.ends_at ? toLocal(c.ends_at) : '' })} className="rounded-lg p-2 text-muted hover:bg-panel hover:text-ink" aria-label={`Edit ${c.code}`}><Pencil size={15} /></button><button onClick={() => setDel(c)} className="rounded-lg p-2 text-muted hover:bg-red-50 hover:text-red-600" aria-label={`Delete ${c.code}`}><Trash2 size={15} /></button></>}</td>
            </tr>
          ))}
        </Table>
      </Card>
      <Modal open={!!edit} onClose={() => setEdit(null)} title={edit?.id ? 'Edit coupon' : 'Create coupon'} footer={<><Button onClick={() => setEdit(null)}>Cancel</Button><Button variant="primary" loading={busy} onClick={save}>Save</Button></>}>
        {edit && (
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Code *" hint="Letters and numbers, e.g. EID500"><Input value={edit.code} onChange={(e) => setEdit({ ...edit, code: e.target.value.toUpperCase() })} className="font-mono uppercase" /></Field>
            <Field label="Type"><Select value={edit.type} onChange={(e) => setEdit({ ...edit, type: e.target.value })}><option value="percent">Percentage off</option><option value="fixed">Fixed amount off (৳)</option><option value="free_delivery">Free delivery</option></Select></Field>
            {edit.type !== 'free_delivery' && <Field label={edit.type === 'percent' ? 'Percent' : 'Amount ৳'}><Input type="number" min={1} value={edit.value} onChange={(e) => setEdit({ ...edit, value: Number(e.target.value) })} /></Field>}
            {edit.type === 'percent' && <Field label="Maximum discount ৳" hint="Optional cap"><Input type="number" min={0} value={edit.max_discount} onChange={(e) => setEdit({ ...edit, max_discount: e.target.value })} /></Field>}
            <Field label="Minimum order ৳"><Input type="number" min={0} value={edit.min_order} onChange={(e) => setEdit({ ...edit, min_order: Number(e.target.value) })} /></Field>
            <Field label="Usage limit" hint="Blank = unlimited"><Input type="number" min={1} value={edit.usage_limit} onChange={(e) => setEdit({ ...edit, usage_limit: e.target.value })} /></Field>
            <Field label="Starts"><Input type="datetime-local" value={edit.starts_at} onChange={(e) => setEdit({ ...edit, starts_at: e.target.value })} /></Field>
            <Field label="Ends"><Input type="datetime-local" value={edit.ends_at} onChange={(e) => setEdit({ ...edit, ends_at: e.target.value })} /></Field>
            <Toggle checked={edit.status === 'active'} onChange={(on) => setEdit({ ...edit, status: on ? 'active' : 'inactive' })} label="Active" />
          </div>
        )}
      </Modal>
      <Confirm open={!!del} onClose={() => setDel(null)} title={`Delete ${del?.code}?`} danger confirm="Delete" text="Customers will no longer be able to use this code. Past orders keep their discount."
        onConfirm={async () => { await api(`/coupons/${del.id}`, { method: 'DELETE' }); toast('Coupon deleted'); setDel(null); reload(); }} />
    </>
  );
}
