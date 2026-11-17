import { createContext, useContext, useEffect, useRef, useState, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react';
import { Loader2, X, ImagePlus, ChevronLeft, ChevronRight, Inbox } from 'lucide-react';
import { api } from '../lib/api';
import { STATUS } from '../lib/format';

const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(' ');
export { cx };

type BtnProps = ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'secondary' | 'ghost' | 'danger' | 'brand'; size?: 'sm' | 'md'; loading?: boolean; icon?: ReactNode };
export function Button({ variant = 'secondary', size = 'md', loading, icon, className, children, disabled, ...rest }: BtnProps) {
  const v = {
    primary: 'bg-ink text-white hover:bg-black',
    brand: 'bg-brand text-white hover:bg-brand-dark',
    secondary: 'border border-line bg-white text-ink hover:border-ink/40',
    ghost: 'text-ink/80 hover:bg-panel',
    danger: 'bg-red-600 text-white hover:bg-red-700',
  }[variant];
  return (
    <button {...rest} disabled={disabled || loading}
      className={cx('inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-lg font-medium transition disabled:cursor-not-allowed disabled:opacity-50', size === 'sm' ? 'px-3 py-1.5 text-[14px]' : 'px-4 py-2.5 text-[15px]', v, className)}>
      {loading ? <Loader2 size={16} className="animate-spin" /> : icon}{children}
    </button>
  );
}

export function Field(props: { label?: string; hint?: string; error?: string; children: ReactNode; className?: string }) {
  return (
    <label className={cx('block', props.className)}>
      {props.label && <span className="label">{props.label}</span>}
      {props.children}
      {props.hint && !props.error && <span className="mt-1 block text-[12px] text-muted">{props.hint}</span>}
      {props.error && <span className="mt-1 block text-[12px] text-red-600">{props.error}</span>}
    </label>
  );
}
export const Input = (p: InputHTMLAttributes<HTMLInputElement>) => <input {...p} className={cx('input', p.className)} />;
export const Textarea = (p: TextareaHTMLAttributes<HTMLTextAreaElement>) => <textarea rows={3} {...p} className={cx('input', p.className)} />;
export const Select = (p: SelectHTMLAttributes<HTMLSelectElement>) => <select {...p} className={cx('input pr-8', p.className)} />;
export const Toggle = (p: { checked: boolean; onChange: (v: boolean) => void; label?: string; disabled?: boolean }) => (
  <label className={cx('inline-flex cursor-pointer items-center gap-2.5', p.disabled && 'opacity-50')}>
    <button type="button" role="switch" aria-checked={p.checked} disabled={p.disabled} onClick={() => p.onChange(!p.checked)}
      className={cx('relative h-5 w-9 rounded-full transition', p.checked ? 'bg-brand' : 'bg-zinc-300')}>
      <span className={cx('absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition', p.checked ? 'left-[18px]' : 'left-0.5')} />
    </button>
    {p.label && <span className="text-[14px]">{p.label}</span>}
  </label>
);

export function PageHeader(props: { title: string; sub?: ReactNode; actions?: ReactNode; back?: ReactNode }) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div>{props.back}<h1 className="text-[26px] leading-tight">{props.title}</h1>{props.sub && <p className="mt-1 text-[15px] text-muted">{props.sub}</p>}</div>
      {props.actions && <div className="flex flex-wrap items-center gap-2">{props.actions}</div>}
    </div>
  );
}

export function Card(props: { title?: ReactNode; actions?: ReactNode; children: ReactNode; className?: string; pad?: boolean }) {
  return (
    <section className={cx('card', props.className)}>
      {(props.title || props.actions) && <div className="flex items-center justify-between gap-3 border-b border-line px-5 py-3.5"><h2 className="text-[17px]">{props.title}</h2>{props.actions}</div>}
      <div className={props.pad === false ? '' : 'p-5'}>{props.children}</div>
    </section>
  );
}

export const Badge = (p: { children: ReactNode; tone?: 'gray' | 'green' | 'red' | 'amber' | 'blue' | 'brand' }) => {
  const t = { gray: 'bg-zinc-100 text-zinc-700 ring-zinc-200', green: 'bg-emerald-50 text-emerald-800 ring-emerald-200', red: 'bg-red-50 text-red-700 ring-red-200', amber: 'bg-amber-50 text-amber-800 ring-amber-200', blue: 'bg-sky-50 text-sky-800 ring-sky-200', brand: 'bg-brand-soft text-brand-dark ring-brand/20' }[p.tone || 'gray'];
  return <span className={cx('inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[13px] font-medium ring-1 ring-inset', t)}>{p.children}</span>;
};
export const StatusBadge = ({ status }: { status: string }) => {
  const s = STATUS[status] || { label: status, cls: 'bg-zinc-100 text-zinc-700 ring-zinc-200' };
  return <span className={cx('inline-flex items-center rounded-full px-2.5 py-0.5 text-[13px] font-medium ring-1 ring-inset', s.cls)}>{s.label}</span>;
};

export function Stat(props: { label: string; value: ReactNode; sub?: ReactNode; icon?: ReactNode; tone?: string }) {
  return (
    <div className="card p-5">
      <div className="flex items-center justify-between text-[14px] font-medium text-muted">{props.label}{props.icon && <span className={cx('rounded-xl p-2', props.tone || 'bg-panel text-ink/70')}>{props.icon}</span>}</div>
      <p className="mt-2 text-[28px] font-semibold tabular-nums">{props.value}</p>
      {props.sub && <p className="mt-1 text-[13.5px] text-muted">{props.sub}</p>}
    </div>
  );
}

export function Modal(props: { open: boolean; onClose: () => void; title: string; children: ReactNode; footer?: ReactNode; wide?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!props.open) return;
    const on = (e: KeyboardEvent) => e.key === 'Escape' && props.onClose();
    addEventListener('keydown', on);
    ref.current?.querySelector<HTMLElement>('input,select,textarea,button')?.focus();
    return () => removeEventListener('keydown', on);
  }, [props.open]);
  if (!props.open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-4" role="dialog" aria-modal="true" aria-label={props.title}>
      <div className="absolute inset-0 bg-black/40" onClick={props.onClose} />
      <div ref={ref} className={cx('relative flex max-h-[92vh] w-full flex-col rounded-t-2xl bg-white shadow-2xl sm:rounded-2xl', props.wide ? 'max-w-3xl' : 'max-w-lg')}>
        <div className="flex items-center justify-between border-b border-line px-5 py-3.5"><h2 className="text-[16px]">{props.title}</h2><button onClick={props.onClose} className="rounded-lg p-1.5 hover:bg-panel" aria-label="Close"><X size={18} /></button></div>
        <div className="flex-1 overflow-y-auto p-5">{props.children}</div>
        {props.footer && <div className="flex justify-end gap-2 border-t border-line px-5 py-3">{props.footer}</div>}
      </div>
    </div>
  );
}

export function Table(props: { head: ReactNode[]; children: ReactNode; empty?: boolean; emptyText?: string; loading?: boolean }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[720px] text-left text-[15px]">
        <thead className="border-b border-line bg-panel/60 text-[12.5px] uppercase tracking-wide text-muted"><tr>{props.head.map((h, i) => <th key={i} className="whitespace-nowrap px-4 py-3 font-semibold">{h}</th>)}</tr></thead>
        <tbody className="divide-y divide-line">{props.children}</tbody>
      </table>
      {props.loading && <div className="flex justify-center py-10 text-muted"><Loader2 className="animate-spin" /></div>}
      {!props.loading && props.empty && <Empty text={props.emptyText} />}
    </div>
  );
}

export const Empty = (p: { text?: string; children?: ReactNode }) => (
  <div className="flex flex-col items-center gap-2 py-12 text-center text-muted"><Inbox size={28} strokeWidth={1.5} /><p>{p.text || 'Nothing here yet.'}</p>{p.children}</div>
);
export const Spinner = () => <div className="flex justify-center py-16 text-muted"><Loader2 className="animate-spin" /></div>;
export const ErrorBox = (p: { error: string | null; onRetry?: () => void }) => p.error ? (
  <div className="flex items-center justify-between gap-3 rounded-lg bg-red-50 px-4 py-3 text-red-800" role="alert"><span>{p.error}</span>{p.onRetry && <Button size="sm" onClick={p.onRetry}>Retry</Button>}</div>
) : null;

export function Pagination(props: { page: number; pages: number; total?: number; onPage: (p: number) => void }) {
  if (props.pages <= 1) return props.total !== undefined ? <p className="px-4 py-3 text-[13px] text-muted">{props.total} results</p> : null;
  return (
    <div className="flex items-center justify-between gap-3 border-t border-line px-4 py-3 text-[14px] text-muted">
      <span>{props.total !== undefined ? `${props.total} results · ` : ''}Page {props.page} of {props.pages}</span>
      <div className="flex gap-1.5">
        <Button size="sm" disabled={props.page <= 1} onClick={() => props.onPage(props.page - 1)} icon={<ChevronLeft size={15} />}>Prev</Button>
        <Button size="sm" disabled={props.page >= props.pages} onClick={() => props.onPage(props.page + 1)}>Next<ChevronRight size={15} /></Button>
      </div>
    </div>
  );
}

// ---------- toasts ----------
type ToastT = { id: number; msg: string; tone: 'ok' | 'err' };
const ToastCtx = createContext<(msg: string, tone?: 'ok' | 'err') => void>(() => {});
export const useToast = () => useContext(ToastCtx);
export function ToastProvider(props: { children: ReactNode }) {
  const [items, setItems] = useState<ToastT[]>([]);
  const push = (msg: string, tone: 'ok' | 'err' = 'ok') => {
    const id = Math.random();
    setItems((x) => [...x, { id, msg, tone }]);
    setTimeout(() => setItems((x) => x.filter((t) => t.id !== id)), tone === 'err' ? 5000 : 2800);
  };
  return (
    <ToastCtx.Provider value={push}>
      {props.children}
      <div className="no-print fixed bottom-4 right-4 z-[70] flex flex-col gap-2" aria-live="polite">
        {items.map((t) => <div key={t.id} className={cx('rounded-lg px-4 py-2.5 text-[14px] font-medium text-white shadow-lg', t.tone === 'ok' ? 'bg-ink' : 'bg-red-600')}>{t.msg}</div>)}
      </div>
    </ToastCtx.Provider>
  );
}

// ---------- image upload (R2) ----------
export function ImageInput(props: { value: string[]; onChange: (v: string[]) => void; max?: number; folder?: string }) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [url, setUrl] = useState('');
  const max = props.max || 8;
  const upload = async (files: FileList | null) => {
    if (!files?.length) return;
    setBusy(true);
    const out = [...props.value];
    for (const f of [...files].slice(0, max - out.length)) {
      const form = new FormData();
      form.append('file', f);
      form.append('folder', props.folder || 'products');
      try { const r = await api<{ url: string }>('/upload', { form }); out.push(r.url); } catch (e: any) { toast(e.message, 'err'); }
    }
    props.onChange(out);
    setBusy(false);
  };
  const move = (i: number, d: number) => { const a = [...props.value]; const [x] = a.splice(i, 1); a.splice(i + d, 0, x); props.onChange(a); };
  return (
    <div>
      <div className="flex flex-wrap gap-2.5">
        {props.value.map((src, i) => (
          <div key={src + i} className="group relative h-40 w-30 overflow-hidden rounded-lg border border-line bg-panel">
            <img src={src} alt="" className="h-full w-full object-cover" />
            {i === 0 && <span className="absolute left-1 top-1 rounded bg-ink/80 px-1.5 text-[10px] font-medium text-white">Main</span>}
            <div className="absolute inset-x-0 bottom-0 flex justify-between bg-black/55 p-1 opacity-0 transition group-hover:opacity-100">
              <button type="button" disabled={i === 0} onClick={() => move(i, -1)} className="px-1 text-white disabled:opacity-30" aria-label="Move left">‹</button>
              <button type="button" onClick={() => props.onChange(props.value.filter((_, k) => k !== i))} className="px-1 text-white" aria-label="Remove image"><X size={14} /></button>
              <button type="button" disabled={i === props.value.length - 1} onClick={() => move(i, 1)} className="px-1 text-white disabled:opacity-30" aria-label="Move right">›</button>
            </div>
          </div>
        ))}
        {props.value.length < max && (
          <label className="flex h-40 w-30 cursor-pointer flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-line text-[12px] text-muted hover:border-ink/40">
            {busy ? <Loader2 size={18} className="animate-spin" /> : <ImagePlus size={18} />}Upload
            <input type="file" accept="image/jpeg,image/png,image/webp,image/avif" multiple className="sr-only" onChange={(e) => upload(e.target.files)} disabled={busy} />
          </label>
        )}
      </div>
      <div className="mt-2 flex gap-2">
        <Input placeholder="…or paste an image URL" value={url} onChange={(e) => setUrl(e.target.value)} className="py-1.5" />
        <Button size="sm" type="button" disabled={!/^https?:\/\//.test(url) || props.value.length >= max} onClick={() => { props.onChange([...props.value, url.trim()]); setUrl(''); }}>Add</Button>
      </div>
    </div>
  );
}

export function Confirm(props: { open: boolean; title: string; text: string; confirm?: string; danger?: boolean; onConfirm: () => Promise<void> | void; onClose: () => void }) {
  const [busy, setBusy] = useState(false);
  return (
    <Modal open={props.open} onClose={props.onClose} title={props.title}
      footer={<><Button onClick={props.onClose}>Cancel</Button><Button variant={props.danger ? 'danger' : 'primary'} loading={busy} onClick={async () => { setBusy(true); try { await props.onConfirm(); } finally { setBusy(false); } }}>{props.confirm || 'Confirm'}</Button></>}>
      <p className="text-[14px] text-ink/80">{props.text}</p>
    </Modal>
  );
}
