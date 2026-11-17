import { useState } from 'react';
import { api } from '../lib/api';
import { Button, Card, Field, Input, PageHeader, useToast } from '../components/ui';
import { useMe } from '../components/Shell';

export default function Account() {
  const me = useMe();
  const toast = useToast();
  const [f, setF] = useState({ current: '', password: '', confirm: '' });
  const [busy, setBusy] = useState(false);
  const save = async () => {
    if (f.password !== f.confirm) { toast('The new passwords do not match', 'err'); return; }
    setBusy(true);
    try { await api('/auth/password', { body: f }); toast('Password changed'); setF({ current: '', password: '', confirm: '' }); } catch (e: any) { toast(e.message, 'err'); }
    setBusy(false);
  };
  return (
    <>
      <PageHeader title="My password" sub={`${me.user.name} · ${me.user.email}`} />
      <Card className="max-w-md">
        <div className="space-y-3">
          <Field label="Current password"><Input type="password" autoComplete="current-password" value={f.current} onChange={(e) => setF({ ...f, current: e.target.value })} /></Field>
          <Field label="New password" hint="At least 8 characters with letters and numbers."><Input type="password" autoComplete="new-password" value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} /></Field>
          <Field label="Confirm new password"><Input type="password" autoComplete="new-password" value={f.confirm} onChange={(e) => setF({ ...f, confirm: e.target.value })} /></Field>
          <Button variant="primary" loading={busy} onClick={save} disabled={!f.current || !f.password}>Change password</Button>
        </div>
      </Card>
    </>
  );
}
