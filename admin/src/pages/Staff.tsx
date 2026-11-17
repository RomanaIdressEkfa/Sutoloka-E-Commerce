import { useState } from 'react';
import { Plus, Pencil } from 'lucide-react';
import { api, useApi } from '../lib/api';
import { dateTime } from '../lib/format';
import { Button, Card, Field, Input, Select, Modal, Table, ErrorBox, PageHeader, Badge, useToast } from '../components/ui';
import { useMe } from '../components/Shell';

const ROLES = { owner: 'Everything, including staff, settings and courier/SMS keys', manager: 'Products, stock, coupons, reports and settings', staff: 'Orders, customers and viewing products' };

export default function Staff() {
  const me = useMe();
  const toast = useToast();
  const { data, error, loading, reload } = useApi<any[]>('/staff');
  const [edit, setEdit] = useState<any>(null);
  const [busy, setBusy] = useState(false);
  const save = async () => {
    setBusy(true);
    try {
      if (edit.id) await api(`/staff/${edit.id}`, { method: 'PUT', body: { name: edit.name, role: edit.role, status: edit.status, password: edit.password || undefined } });
      else await api('/staff', { body: edit });
      toast('Saved'); setEdit(null); reload();
    } catch (e: any) { toast(e.message, 'err'); }
    setBusy(false);
  };
  return (
    <>
      <PageHeader title="Staff & roles" sub="Give each team member their own login." actions={<Button variant="primary" icon={<Plus size={16} />} onClick={() => setEdit({ name: '', email: '', role: 'staff', password: '', status: 'active' })}>Add staff</Button>} />
      <div className="mb-4 grid gap-3 md:grid-cols-3">{Object.entries(ROLES).map(([k, v]) => <Card key={k}><p className="font-semibold capitalize">{k}</p><p className="mt-1 text-[13px] text-muted">{v}</p></Card>)}</div>
      <Card pad={false}>
        <ErrorBox error={error} onRetry={reload} />
        <Table loading={loading && !data} empty={!data?.length} head={['Name', 'Email', 'Role', 'Status', 'Last sign-in', '']}>
          {(data || []).map((u) => (
            <tr key={u.id} className="hover:bg-panel/50">
              <td className="px-4 py-2.5 font-medium">{u.name}{u.id === me.user.id && <span className="ml-2 text-[12px] text-muted">(you)</span>}</td>
              <td className="px-4 py-2.5 text-muted">{u.email}</td>
              <td className="px-4 py-2.5 capitalize">{u.role}</td>
              <td className="px-4 py-2.5"><Badge tone={u.status === 'active' ? 'green' : 'gray'}>{u.status}</Badge></td>
              <td className="px-4 py-2.5 text-muted">{dateTime(u.last_login_at)}</td>
              <td className="px-4 py-2.5 text-right"><button onClick={() => setEdit({ ...u, password: '' })} className="rounded-lg p-2 text-muted hover:bg-panel hover:text-ink" aria-label={`Edit ${u.name}`}><Pencil size={15} /></button></td>
            </tr>
          ))}
        </Table>
      </Card>
      <Modal open={!!edit} onClose={() => setEdit(null)} title={edit?.id ? `Edit ${edit.name}` : 'Add staff member'} footer={<><Button onClick={() => setEdit(null)}>Cancel</Button><Button variant="primary" loading={busy} onClick={save}>Save</Button></>}>
        {edit && (
          <div className="grid gap-3">
            <Field label="Name"><Input value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} /></Field>
            <Field label="Email"><Input type="email" value={edit.email} disabled={!!edit.id} onChange={(e) => setEdit({ ...edit, email: e.target.value })} /></Field>
            <Field label="Role"><Select value={edit.role} onChange={(e) => setEdit({ ...edit, role: e.target.value })}>{Object.keys(ROLES).map((r) => <option key={r} value={r} className="capitalize">{r}</option>)}</Select></Field>
            {edit.id && <Field label="Status"><Select value={edit.status} onChange={(e) => setEdit({ ...edit, status: e.target.value })}><option value="active">Active</option><option value="disabled">Disabled (cannot sign in)</option></Select></Field>}
            <Field label={edit.id ? 'New password (optional)' : 'Password'} hint="At least 8 characters with letters and numbers. Share it privately."><Input type="password" autoComplete="new-password" value={edit.password} onChange={(e) => setEdit({ ...edit, password: e.target.value })} /></Field>
          </div>
        )}
      </Modal>
    </>
  );
}
