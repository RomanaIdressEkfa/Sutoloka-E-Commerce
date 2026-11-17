import { useEffect, useState, type FormEvent } from 'react';
import { api } from '../lib/api';
import { Button, Field, Input } from '../components/ui';

export default function Login(props: { onDone: () => void }) {
  const [setup, setSetup] = useState<boolean | null>(null);
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => { api('/auth/setup').then((r) => setSetup(r.needed)).catch(() => setSetup(false)); }, []);
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true); setError('');
    try {
      await api(setup ? '/auth/setup' : '/auth/login', { body: form });
      props.onDone();
    } catch (err: any) { setError(err.message); }
    setBusy(false);
  };
  if (setup === null) return null;
  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <form onSubmit={submit} className="card w-full max-w-sm p-7">
        <div className="mb-6 flex items-center gap-2">
          <svg width="30" height="30" viewBox="0 0 64 64" aria-hidden="true"><circle cx="24" cy="26" r="13" fill="#b4235a" /><circle cx="40" cy="26" r="13" fill="#f59f00" fillOpacity=".9" /><circle cx="32" cy="40" r="13" fill="#12b886" fillOpacity=".85" /></svg>
          <span className="flex flex-col leading-none"><span className="text-[19px] font-bold">Sutoloka Admin</span><span className="mt-1 text-[13px] font-medium text-brand">সুতোলোকা</span></span>
        </div>
        <h1 className="text-[20px]">{setup ? 'Create the owner account' : 'Sign in'}</h1>
        <p className="mt-1 text-muted">{setup ? 'This is the first sign-in. The account you create here has full access.' : 'Use your staff username and password.'}</p>
        <div className="mt-6 space-y-4">
          {setup && <Field label="Your name"><Input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} autoComplete="name" /></Field>}
          <Field label="Username or email"><Input required autoCapitalize="none" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value.trim().toLowerCase() })} autoComplete="username" /></Field>
          <Field label="Password" hint={setup ? 'At least 8 characters.' : undefined}>
            <Input required type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} autoComplete={setup ? 'new-password' : 'current-password'} />
          </Field>
          {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-red-700" role="alert">{error}</p>}
          <Button variant="primary" className="w-full py-2.5" loading={busy}>{setup ? 'Create account' : 'Sign in'}</Button>
        </div>
      </form>
    </div>
  );
}
