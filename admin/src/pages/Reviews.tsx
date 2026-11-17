import { useState } from 'react';
import { Check, EyeOff, Trash2, MessageSquareReply } from 'lucide-react';
import { api, useApi } from '../lib/api';
import { Link, useQuery } from '../lib/router';
import { dateTime } from '../lib/format';
import { Button, Card, Textarea, Modal, Pagination, ErrorBox, PageHeader, Badge, Spinner, Empty, useToast, cx } from '../components/ui';
import { useMe, canManage } from '../components/Shell';

const Stars = ({ n }: { n: number }) => <span className="text-[15px] tracking-tight text-[#f59f00]" aria-label={`${n} stars`}>{'★'.repeat(n)}<span className="text-line">{'★'.repeat(5 - n)}</span></span>;

export default function Reviews() {
  const me = useMe();
  const toast = useToast();
  const { q, get, set } = useQuery();
  const status = get('status');
  const { data, error, loading, reload } = useApi(`/reviews?${q.toString()}`);
  const [reply, setReply] = useState<any>(null);
  const [text, setText] = useState('');
  const act = async (id: number, body: any, msg: string) => { try { await api(`/reviews/${id}`, { method: 'PATCH', body }); toast(msg); reload(); } catch (e: any) { toast(e.message, 'err'); } };
  const rows: any[] = data?.rows || [];
  return (
    <>
      <PageHeader title="Reviews" sub="Reviews from verified buyers go live automatically; others wait for approval here." />
      <div className="mb-3 flex gap-1 border-b border-line">
        {[['', 'All'], ['pending', `Pending${data?.pending ? ` (${data.pending})` : ''}`], ['approved', 'Approved'], ['hidden', 'Hidden']].map(([k, l]) => (
          <button key={k} onClick={() => set({ status: k })} className={cx('-mb-px border-b-2 px-3 py-2 text-[14px] font-medium', status === k ? 'border-brand text-brand-dark' : 'border-transparent text-muted hover:text-ink')}>{l}</button>
        ))}
      </div>
      <ErrorBox error={error} onRetry={reload} />
      {loading && !data ? <Spinner /> : !rows.length ? <Card><Empty text="No reviews here." /></Card> : (
        <div className="space-y-3">
          {rows.map((r) => (
            <Card key={r.id}>
              <div className="flex flex-wrap items-start gap-4">
                {r.thumbnail && <img src={r.thumbnail} alt="" className="h-24 w-18 rounded-lg object-cover" />}
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2"><Stars n={r.rating} />{r.title && <strong>{r.title}</strong>}<Badge tone={r.status === 'approved' ? 'green' : r.status === 'pending' ? 'amber' : 'gray'}>{r.status}</Badge>{r.verified ? <Badge tone="blue">Verified buyer</Badge> : null}</div>
                  <p className="mt-1 text-[13px] text-muted">{r.name} on <Link to={`/products/${r.product_id}`} className="font-medium text-ink hover:underline">{r.product_name}</Link> · {dateTime(r.created_at)}{r.size_bought ? ` · Size ${r.size_bought}` : ''}{r.fit ? ` · Fit: ${r.fit === 'true' ? 'true to size' : `runs ${r.fit}`}` : ''}</p>
                  <p className="mt-2">{r.body}</p>
                  {r.photos.length > 0 && <div className="mt-2 flex gap-2">{r.photos.map((p: string) => <a key={p} href={p.startsWith('/') ? me.storeUrl + p : p} target="_blank" rel="noopener"><img src={p.startsWith('/') ? me.storeUrl + p : p} alt="Review photo" className="h-16 w-16 rounded-lg object-cover" /></a>)}</div>}
                  {r.reply && <p className="mt-2 rounded-lg bg-panel px-3 py-2 text-[13px]"><strong>Your reply:</strong> {r.reply}</p>}
                </div>
                {canManage(me) && (
                  <div className="flex flex-wrap gap-1.5">
                    {r.status !== 'approved' && <Button size="sm" variant="primary" icon={<Check size={14} />} onClick={() => act(r.id, { status: 'approved' }, 'Review approved')}>Approve</Button>}
                    {r.status !== 'hidden' && <Button size="sm" icon={<EyeOff size={14} />} onClick={() => act(r.id, { status: 'hidden' }, 'Review hidden')}>Hide</Button>}
                    <Button size="sm" icon={<MessageSquareReply size={14} />} onClick={() => { setReply(r); setText(r.reply || ''); }}>Reply</Button>
                    <button onClick={async () => { if (confirm('Delete this review permanently?')) { await api(`/reviews/${r.id}`, { method: 'DELETE' }); toast('Review deleted'); reload(); } }} className="rounded-lg p-2 text-muted hover:bg-red-50 hover:text-red-600" aria-label="Delete review"><Trash2 size={15} /></button>
                  </div>
                )}
              </div>
            </Card>
          ))}
          {data && <Card pad={false}><Pagination page={data.page} pages={data.pages} total={data.total} onPage={(p) => set({ page: p })} /></Card>}
        </div>
      )}
      <Modal open={!!reply} onClose={() => setReply(null)} title="Reply publicly" footer={<><Button onClick={() => setReply(null)}>Cancel</Button><Button variant="primary" onClick={async () => { await act(reply.id, { reply: text }, 'Reply posted'); setReply(null); }}>Post reply</Button></>}>
        <Textarea rows={4} value={text} onChange={(e) => setText(e.target.value)} placeholder="Thank you for your review…" />
      </Modal>
    </>
  );
}
