import { useEffect, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { api, useApi } from '../lib/api';
import { useQuery } from '../lib/router';
import { Button, Card, Field, Input, Select, Textarea, Toggle, ImageInput, Spinner, ErrorBox, PageHeader, useToast, cx } from '../components/ui';
import { useMe } from '../components/Shell';

export default function Settings() {
  const me = useMe();
  const owner = me.user.role === 'owner';
  const { get, set } = useQuery();
  const { data, error, loading, reload } = useApi('/settings');
  const tab = get('tab') || 'store';
  const tabs = [['store', 'Store'], ['delivery', 'Delivery'], ['offers', 'Offers & rewards'], ['home', 'Homepage'], ['pages', 'Pages'], ...(owner ? [['courier', 'Courier'], ['sms', 'SMS']] : [])];
  if (loading && !data) return <Spinner />;
  if (error) return <ErrorBox error={error} onRetry={reload} />;
  return (
    <>
      <PageHeader title="Settings" />
      <div className="no-scrollbar mb-4 flex gap-1 overflow-x-auto border-b border-line">
        {tabs.map(([k, l]) => <button key={k} onClick={() => set({ tab: k })} className={cx('-mb-px whitespace-nowrap border-b-2 px-3 py-2 text-[14px] font-medium', tab === k ? 'border-brand text-brand-dark' : 'border-transparent text-muted hover:text-ink')}>{l}</button>)}
      </div>
      {tab === 'store' && <StoreTab s={data} onSaved={reload} />}
      {tab === 'delivery' && <DeliveryTab s={data} onSaved={reload} />}
      {tab === 'offers' && <OffersTab s={data} onSaved={reload} />}
      {tab === 'home' && <HomeTab s={data} onSaved={reload} />}
      {tab === 'pages' && <PagesTab />}
      {tab === 'courier' && owner && <CourierTab s={data} onSaved={reload} />}
      {tab === 'sms' && owner && <SmsTab s={data} onSaved={reload} />}
    </>
  );
}

function useSave(key: string, onSaved: () => void) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const save = async (value: any) => {
    setBusy(true);
    try { await api(`/settings/${key}`, { method: 'PUT', body: value }); toast('Settings saved'); onSaved(); } catch (e: any) { toast(e.message, 'err'); }
    setBusy(false);
  };
  return { busy, save };
}

function StoreTab(props: { s: any; onSaved: () => void }) {
  const [v, setV] = useState(props.s.store || {});
  const [ann, setAnn] = useState(props.s.announcement || { text: '', enabled: false });
  const a = useSave('store', props.onSaved), b = useSave('announcement', props.onSaved);
  const f = (k: string, label: string, hint?: string) => <Field label={label} hint={hint}><Input value={v[k] || ''} onChange={(e) => setV({ ...v, [k]: e.target.value })} /></Field>;
  return (
    <div className="grid gap-4 xl:grid-cols-2">
      <Card title="Store details">
        <div className="grid gap-3 sm:grid-cols-2">
          {f('name', 'Store name')}{f('name_bn', 'Store name in Bangla')}{f('tagline', 'Tagline')}{f('phone', 'Hotline', 'Shown in the footer and menu')}{f('phone2', 'Second phone')}
          {f('email', 'Email')}{f('address', 'Address')}{f('facebook', 'Facebook page URL')}{f('instagram', 'Instagram URL')}
          {f('whatsapp', 'WhatsApp number', 'With country code, e.g. 8801XXXXXXXXX — shows a chat button')}
        </div>
        <Button variant="primary" className="mt-4" loading={a.busy} onClick={() => a.save(v)}>Save</Button>
      </Card>
      <Card title="Announcement bar">
        <Toggle checked={!!ann.enabled} onChange={(enabled) => setAnn({ ...ann, enabled })} label="Show the bar at the top of every page" />
        <Field label="Text" className="mt-3"><Input value={ann.text} onChange={(e) => setAnn({ ...ann, text: e.target.value })} placeholder="Free delivery over ৳3,000 · Cash on delivery" /></Field>
        <Button variant="primary" className="mt-4" loading={b.busy} onClick={() => b.save(ann)}>Save</Button>
      </Card>
    </div>
  );
}

function DeliveryTab(props: { s: any; onSaved: () => void }) {
  const [v, setV] = useState(props.s.delivery || {});
  const { busy, save } = useSave('delivery', props.onSaved);
  const n = (k: string, label: string, hint?: string) => <Field label={label} hint={hint}><Input type="number" min={0} value={v[k] ?? 0} onChange={(e) => setV({ ...v, [k]: Number(e.target.value) })} /></Field>;
  return (
    <Card title="Delivery charges (৳)" className="max-w-2xl">
      <div className="grid gap-3 sm:grid-cols-3">{n('inside_dhaka', 'Inside Dhaka city')}{n('sub_dhaka', 'Dhaka sub-areas', 'Savar, Keraniganj, Gazipur, Narayanganj')}{n('outside_dhaka', 'Outside Dhaka')}</div>
      <div className="mt-3 grid gap-3 sm:grid-cols-3">
        {n('free_over', 'Free delivery over ৳', '0 = never free')}
        <Field label="Dhaka delivery time"><Input value={v.inside_days || ''} onChange={(e) => setV({ ...v, inside_days: e.target.value })} placeholder="1–2 days" /></Field>
        <Field label="Outside Dhaka time"><Input value={v.outside_days || ''} onChange={(e) => setV({ ...v, outside_days: e.target.value })} placeholder="2–4 days" /></Field>
      </div>
      <Button variant="primary" className="mt-4" loading={busy} onClick={() => save(v)}>Save</Button>
    </Card>
  );
}

function OffersTab(props: { s: any; onSaved: () => void }) {
  const [o, setO] = useState(props.s.offers || { enabled: false, tiers: [] });
  const [r, setR] = useState(props.s.rewards || { enabled: false, earn_per_100: 1, point_value: 1, max_redeem_percent: 20, min_redeem: 50 });
  const a = useSave('offers', props.onSaved), b = useSave('rewards', props.onSaved);
  return (
    <div className="grid gap-4 xl:grid-cols-2">
      <Card title="Buy more, save more">
        <Toggle checked={o.enabled} onChange={(enabled) => setO({ ...o, enabled })} label="Discount for buying several items" />
        <div className="mt-4 space-y-2">
          {o.tiers.map((t: any, i: number) => (
            <div key={i} className="flex items-end gap-2">
              <Field label="Items (at least)"><Input type="number" min={2} value={t.min_qty} onChange={(e) => setO({ ...o, tiers: o.tiers.map((x: any, k: number) => k === i ? { ...x, min_qty: Number(e.target.value) } : x) })} /></Field>
              <Field label="Discount %"><Input type="number" min={1} max={50} value={t.percent} onChange={(e) => setO({ ...o, tiers: o.tiers.map((x: any, k: number) => k === i ? { ...x, percent: Number(e.target.value) } : x) })} /></Field>
              <button onClick={() => setO({ ...o, tiers: o.tiers.filter((_: any, k: number) => k !== i) })} className="mb-1 rounded-lg p-2 text-muted hover:bg-red-50 hover:text-red-600" aria-label="Remove tier"><Trash2 size={16} /></button>
            </div>
          ))}
          <Button size="sm" icon={<Plus size={14} />} onClick={() => setO({ ...o, tiers: [...o.tiers, { min_qty: (o.tiers.at(-1)?.min_qty || 1) + 1, percent: 5 }] })}>Add tier</Button>
        </div>
        <Button variant="primary" className="mt-4" loading={a.busy} onClick={() => a.save(o)}>Save</Button>
      </Card>
      <Card title="Reward points">
        <Toggle checked={r.enabled} onChange={(enabled) => setR({ ...r, enabled })} label="Customers earn points on delivered orders" />
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <Field label="Points per ৳100 spent"><Input type="number" min={0} value={r.earn_per_100} onChange={(e) => setR({ ...r, earn_per_100: Number(e.target.value) })} /></Field>
          <Field label="Value of 1 point (৳)"><Input type="number" min={0} step="0.1" value={r.point_value} onChange={(e) => setR({ ...r, point_value: Number(e.target.value) })} /></Field>
          <Field label="Max % of an order paid with points"><Input type="number" min={0} max={100} value={r.max_redeem_percent} onChange={(e) => setR({ ...r, max_redeem_percent: Number(e.target.value) })} /></Field>
          <Field label="Minimum points to redeem"><Input type="number" min={0} value={r.min_redeem} onChange={(e) => setR({ ...r, min_redeem: Number(e.target.value) })} /></Field>
        </div>
        <p className="mt-3 text-[13px] text-muted">Example: a ৳2,500 order earns {Math.floor(25 * (r.earn_per_100 || 0))} points, worth {Math.round(Math.floor(25 * (r.earn_per_100 || 0)) * (r.point_value || 0))} Taka on a later order.</p>
        <Button variant="primary" className="mt-4" loading={b.busy} onClick={() => b.save(r)}>Save</Button>
      </Card>
    </div>
  );
}

function HomeTab(props: { s: any; onSaved: () => void }) {
  const [h, setH] = useState(props.s.home || { hero: [], featured_categories: [] });
  const { data: cats } = useApi<any[]>('/categories');
  const { busy, save } = useSave('home', props.onSaved);
  const setSlide = (i: number, patch: any) => setH({ ...h, hero: h.hero.map((s: any, k: number) => (k === i ? { ...s, ...patch } : s)) });
  return (
    <div className="space-y-4">
      <Card title="Hero slides" actions={<Button size="sm" icon={<Plus size={14} />} onClick={() => setH({ ...h, hero: [...h.hero, { image: '', title: '', subtitle: '', link: '/shop', button: 'Shop now' }] })}>Add slide</Button>}>
        <div className="space-y-4">
          {h.hero.map((s: any, i: number) => (
            <div key={i} className="grid gap-3 rounded-lg border border-line p-3 md:grid-cols-[180px_1fr]">
              <ImageInput value={s.image ? [s.image] : []} onChange={(v) => setSlide(i, { image: v[0] || '' })} max={1} folder="banners" />
              <div className="grid gap-2 sm:grid-cols-2">
                <Field label="Headline"><Input value={s.title} onChange={(e) => setSlide(i, { title: e.target.value })} /></Field>
                <Field label="Sub text"><Input value={s.subtitle} onChange={(e) => setSlide(i, { subtitle: e.target.value })} /></Field>
                <Field label="Button text"><Input value={s.button} onChange={(e) => setSlide(i, { button: e.target.value })} /></Field>
                <Field label="Button link"><Input value={s.link} onChange={(e) => setSlide(i, { link: e.target.value })} placeholder="/category/women" /></Field>
                <div><Button size="sm" variant="ghost" icon={<Trash2 size={14} />} onClick={() => setH({ ...h, hero: h.hero.filter((_: any, k: number) => k !== i) })}>Remove slide</Button></div>
              </div>
            </div>
          ))}
          <p className="text-[12px] text-muted">Use wide photos (about 2000 × 1000 px). Text appears on the left over a dark gradient.</p>
        </div>
      </Card>
      <Card title="Category circles on the homepage">
        <div className="flex flex-wrap gap-2">
          {(cats || []).filter((c) => c.status === 'active').map((c) => {
            const on = h.featured_categories.includes(c.id);
            return <button key={c.id} onClick={() => setH({ ...h, featured_categories: on ? h.featured_categories.filter((x: number) => x !== c.id) : [...h.featured_categories, c.id] })} className={cx('rounded-full border px-3 py-1.5 text-[13px]', on ? 'border-brand bg-brand-soft text-brand-dark' : 'border-line')}>{c.name}</button>;
          })}
        </div>
      </Card>
      <Button variant="primary" loading={busy} onClick={() => save(h)}>Save homepage</Button>
    </div>
  );
}

function PagesTab() {
  const toast = useToast();
  const { data, reload } = useApi<any[]>('/pages');
  const [cur, setCur] = useState<any>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (data && !cur) setCur(data[0] || null); }, [data]);
  const save = async () => {
    setBusy(true);
    try { await api(`/pages/${cur.slug}`, { method: 'PUT', body: cur }); toast('Page saved'); reload(); } catch (e: any) { toast(e.message, 'err'); }
    setBusy(false);
  };
  return (
    <div className="grid gap-4 lg:grid-cols-[220px_1fr]">
      <Card pad={false}><ul className="p-2">{(data || []).map((p) => <li key={p.slug}><button onClick={() => setCur(p)} className={cx('w-full rounded-lg px-3 py-2 text-left text-[14px]', cur?.slug === p.slug ? 'bg-brand-soft font-medium text-brand-dark' : 'hover:bg-panel')}>{p.title}</button></li>)}</ul></Card>
      {cur && (
        <Card title={`/pages/${cur.slug}`}>
          <Field label="Title"><Input value={cur.title} onChange={(e) => setCur({ ...cur, title: e.target.value })} /></Field>
          <Field label="Content (HTML)" hint="Use <h3>, <p>, <ul><li> and <strong> for formatting." className="mt-3"><Textarea rows={16} value={cur.body} onChange={(e) => setCur({ ...cur, body: e.target.value })} className="font-mono text-[13px]" /></Field>
          <Button variant="primary" className="mt-3" loading={busy} onClick={save}>Save page</Button>
        </Card>
      )}
    </div>
  );
}

function CourierTab(props: { s: any; onSaved: () => void }) {
  const [c, setC] = useState(props.s.courier || {});
  const { busy, save } = useSave('courier', props.onSaved);
  const f = (group: string, k: string, label: string, secret = false) => (
    <Field label={label}><Input type={secret ? 'password' : 'text'} autoComplete="off" value={c[group]?.[k] || ''} onChange={(e) => setC({ ...c, [group]: { ...c[group], [k]: e.target.value } })} /></Field>
  );
  return (
    <div className="space-y-4">
      <p className="rounded-lg bg-amber-50 px-4 py-2.5 text-[13px] text-amber-900">Get these keys from each courier's merchant panel (API section). Test each courier once with a real order before relying on it.</p>
      <div className="grid gap-4 xl:grid-cols-3">
        <Card title="Steadfast"><div className="space-y-3">{f('steadfast', 'api_key', 'API key')}{f('steadfast', 'secret_key', 'Secret key', true)}</div></Card>
        <Card title="Pathao">
          <div className="space-y-3">{f('pathao', 'client_id', 'Client ID')}{f('pathao', 'client_secret', 'Client secret', true)}{f('pathao', 'username', 'Merchant email')}{f('pathao', 'password', 'Merchant password', true)}{f('pathao', 'store_id', 'Store ID')}
            <Toggle checked={!!c.pathao?.sandbox} onChange={(v) => setC({ ...c, pathao: { ...c.pathao, sandbox: v } })} label="Sandbox (testing)" /></div>
        </Card>
        <Card title="RedX"><div className="space-y-3">{f('redx', 'token', 'API access token', true)}<Toggle checked={!!c.redx?.sandbox} onChange={(v) => setC({ ...c, redx: { ...c.redx, sandbox: v } })} label="Sandbox (testing)" /></div></Card>
      </div>
      <Field label="Default courier" className="max-w-xs"><Select value={c.default || 'steadfast'} onChange={(e) => setC({ ...c, default: e.target.value })}><option value="steadfast">Steadfast</option><option value="pathao">Pathao</option><option value="redx">RedX</option></Select></Field>
      <Button variant="primary" loading={busy} onClick={() => save(c)}>Save courier settings</Button>
    </div>
  );
}

function SmsTab(props: { s: any; onSaved: () => void }) {
  const [v, setV] = useState(props.s.sms || { provider: 'none', api_key: '', sender_id: '', url_template: '' });
  const { busy, save } = useSave('sms', props.onSaved);
  return (
    <Card title="SMS gateway" className="max-w-2xl">
      <p className="mb-4 text-[13px] text-muted">Used for customer login codes and back-in-stock messages. Without SMS, customers can still check out as guests.</p>
      <div className="space-y-3">
        <Field label="Provider"><Select value={v.provider} onChange={(e) => setV({ ...v, provider: e.target.value })}><option value="none">Off</option><option value="bulksmsbd">BulkSMSBD</option><option value="custom">Other gateway (custom URL)</option></Select></Field>
        {v.provider !== 'none' && <>
          <Field label="API key"><Input type="password" autoComplete="off" value={v.api_key} onChange={(e) => setV({ ...v, api_key: e.target.value })} /></Field>
          <Field label="Sender ID" hint="Approved masking name or number"><Input value={v.sender_id} onChange={(e) => setV({ ...v, sender_id: e.target.value })} /></Field>
        </>}
        {v.provider === 'custom' && <Field label="Send URL" hint="Placeholders: {phone} (8801…), {phone_local} (01…), {message}, {api_key}, {sender_id}"><Textarea rows={2} value={v.url_template} onChange={(e) => setV({ ...v, url_template: e.target.value })} placeholder="https://gateway.example/api/send?key={api_key}&to={phone}&text={message}" className="font-mono text-[13px]" /></Field>}
      </div>
      <Button variant="primary" className="mt-4" loading={busy} onClick={() => save(v)}>Save</Button>
    </Card>
  );
}
