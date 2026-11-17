import { useState } from 'react';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import { api, useApi } from '../lib/api';
import { Button, Card, Field, Input, Select, Textarea, Toggle, Modal, Table, ErrorBox, PageHeader, Badge, ImageInput, Confirm, useToast } from '../components/ui';
import { useMe, canManage } from '../components/Shell';

const empty = { id: 0, name: '', slug: '', parent_id: '', description: '', image: '', size_chart: '', sort: 0, featured: false, status: 'active' };

export default function Categories() {
  const me = useMe();
  const toast = useToast();
  const { data, error, loading, reload } = useApi<any[]>('/categories');
  const [edit, setEdit] = useState<typeof empty | null>(null);
  const [del, setDel] = useState<any>(null);
  const [busy, setBusy] = useState(false);
  const rows = data || [];
  const save = async () => {
    if (!edit) return;
    setBusy(true);
    try {
      await api(edit.id ? `/categories/${edit.id}` : '/categories', { method: edit.id ? 'PUT' : 'POST', body: { ...edit, parent_id: edit.parent_id ? Number(edit.parent_id) : null } });
      toast('Category saved'); setEdit(null); reload();
    } catch (e: any) { toast(e.message, 'err'); }
    setBusy(false);
  };
  return (
    <>
      <PageHeader title="Categories" sub="Main menu sections and their sub-categories."
        actions={canManage(me) && <Button variant="primary" icon={<Plus size={16} />} onClick={() => setEdit({ ...empty })}>Add category</Button>} />
      <Card pad={false}>
        <ErrorBox error={error} onRetry={reload} />
        <Table loading={loading && !data} empty={!rows.length} head={['Category', 'URL', 'Products', 'Order', 'Status', '']}>
          {rows.map((c) => (
            <tr key={c.id} className="hover:bg-panel/50">
              <td className="px-4 py-2.5"><div className={`flex items-center gap-3 ${c.parent_id ? 'pl-8' : ''}`}>{c.image ? <img src={c.image} alt="" className="h-9 w-9 rounded-full object-cover" /> : <span className="h-9 w-9 rounded-full bg-panel" />}<span className={c.parent_id ? '' : 'font-semibold'}>{c.name}</span></div></td>
              <td className="px-4 py-2.5 text-muted">/category/{c.slug}</td>
              <td className="px-4 py-2.5 tabular-nums">{c.products}</td>
              <td className="px-4 py-2.5 tabular-nums text-muted">{c.sort}</td>
              <td className="px-4 py-2.5"><Badge tone={c.status === 'active' ? 'green' : 'gray'}>{c.status === 'active' ? 'Visible' : 'Hidden'}</Badge></td>
              <td className="px-4 py-2.5 text-right">{canManage(me) && <><button onClick={() => setEdit({ ...c, parent_id: c.parent_id ? String(c.parent_id) : '', image: c.image || '', size_chart: c.size_chart || '', featured: !!c.featured })} className="rounded-lg p-2 text-muted hover:bg-panel hover:text-ink" aria-label={`Edit ${c.name}`}><Pencil size={15} /></button><button onClick={() => setDel(c)} className="rounded-lg p-2 text-muted hover:bg-red-50 hover:text-red-600" aria-label={`Delete ${c.name}`}><Trash2 size={15} /></button></>}</td>
            </tr>
          ))}
        </Table>
      </Card>
      <Modal open={!!edit} onClose={() => setEdit(null)} title={edit?.id ? 'Edit category' : 'Add category'} footer={<><Button onClick={() => setEdit(null)}>Cancel</Button><Button variant="primary" loading={busy} onClick={save}>Save</Button></>}>
        {edit && (
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Name *"><Input value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} /></Field>
            <Field label="URL slug" hint="Blank = from name"><Input value={edit.slug} onChange={(e) => setEdit({ ...edit, slug: e.target.value })} /></Field>
            <Field label="Parent"><Select value={edit.parent_id} onChange={(e) => setEdit({ ...edit, parent_id: e.target.value })}><option value="">— Top level (menu) —</option>{rows.filter((c) => !c.parent_id && c.id !== edit.id).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</Select></Field>
            <Field label="Menu order"><Input type="number" value={edit.sort} onChange={(e) => setEdit({ ...edit, sort: Number(e.target.value) })} /></Field>
            <Field label="Description" className="sm:col-span-2"><Textarea rows={2} value={edit.description} onChange={(e) => setEdit({ ...edit, description: e.target.value })} /></Field>
            <Field label="Image" className="sm:col-span-2"><ImageInput value={edit.image ? [edit.image] : []} onChange={(v) => setEdit({ ...edit, image: v[0] || '' })} max={1} folder="categories" /></Field>
            <Field label="Size chart image" className="sm:col-span-2"><ImageInput value={edit.size_chart ? [edit.size_chart] : []} onChange={(v) => setEdit({ ...edit, size_chart: v[0] || '' })} max={1} folder="categories" /></Field>
            <Toggle checked={edit.status === 'active'} onChange={(on) => setEdit({ ...edit, status: on ? 'active' : 'hidden' })} label="Visible in store" />
          </div>
        )}
      </Modal>
      <Confirm open={!!del} onClose={() => setDel(null)} title={`Delete ${del?.name}?`} danger confirm="Delete" text="Only empty categories can be deleted. To hide a category with products, edit it and switch off “Visible in store”."
        onConfirm={async () => { try { await api(`/categories/${del.id}`, { method: 'DELETE' }); toast('Category deleted'); reload(); } catch (e: any) { toast(e.message, 'err'); } setDel(null); }} />
    </>
  );
}
