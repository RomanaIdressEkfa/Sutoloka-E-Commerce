export const taka = (n: number | null | undefined) => '৳' + Math.round(Number(n) || 0).toLocaleString('en-IN');
export const num = (n: number | null | undefined) => Math.round(Number(n) || 0).toLocaleString('en-IN');

export const dateTime = (iso?: string | null) =>
  iso ? new Date(iso).toLocaleString('en-GB', { timeZone: 'Asia/Dhaka', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' }) : '—';
export const date = (iso?: string | null) =>
  iso ? new Date(iso).toLocaleDateString('en-GB', { timeZone: 'Asia/Dhaka', day: 'numeric', month: 'short', year: 'numeric' }) : '—';
export const ago = (iso?: string | null) => {
  if (!iso) return '—';
  const s = (Date.now() - Date.parse(iso)) / 1000;
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 86400) return `${Math.floor(s / 3600)} h ago`;
  if (s < 86400 * 7) return `${Math.floor(s / 86400)} d ago`;
  return date(iso);
};
/** Today's date in Bangladesh as YYYY-MM-DD. */
export const bdToday = (offsetDays = 0) => new Date(Date.now() + 6 * 3600_000 + offsetDays * 86400_000).toISOString().slice(0, 10);

export const STATUS: Record<string, { label: string; cls: string }> = {
  pending: { label: 'Pending', cls: 'bg-amber-50 text-amber-800 ring-amber-200' },
  confirmed: { label: 'Confirmed', cls: 'bg-sky-50 text-sky-800 ring-sky-200' },
  processing: { label: 'Packing', cls: 'bg-indigo-50 text-indigo-800 ring-indigo-200' },
  shipped: { label: 'Shipped', cls: 'bg-violet-50 text-violet-800 ring-violet-200' },
  delivered: { label: 'Delivered', cls: 'bg-emerald-50 text-emerald-800 ring-emerald-200' },
  cancelled: { label: 'Cancelled', cls: 'bg-zinc-100 text-zinc-700 ring-zinc-200' },
  returned: { label: 'Returned', cls: 'bg-red-50 text-red-800 ring-red-200' },
};
export const ORDER_FLOW = ['pending', 'confirmed', 'processing', 'shipped', 'delivered'];

export { DISTRICTS } from '../../../shared/bd';
