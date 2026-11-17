// Courier integrations (Bangladesh). Credentials live in settings.courier (admin → Settings → Courier).
// NOTE: written against each courier's public merchant API docs; verify with real credentials before relying on it.

export type CourierName = 'steadfast' | 'pathao' | 'redx';
export type CourierSettings = {
  default?: CourierName;
  steadfast: { api_key: string; secret_key: string };
  pathao: { client_id: string; client_secret: string; username: string; password: string; store_id: string; sandbox?: boolean };
  redx: { token: string; sandbox?: boolean };
};
export type Parcel = {
  invoice: string; name: string; phone: string; address: string; district: string; area?: string | null;
  cod: number; note?: string | null; items: number; description: string;
};
export type Booking = { consignment_id: string; tracking_code: string; status: string };

class CourierError extends Error {}
export { CourierError };

async function call(url: string, init: RequestInit) {
  const r = await fetch(url, init);
  const text = await r.text();
  let data: any;
  try { data = JSON.parse(text); } catch { data = { raw: text.slice(0, 300) }; }
  if (!r.ok) throw new CourierError(String(data?.message || (data?.errors ? JSON.stringify(data.errors) : `Courier API error ${r.status}`)));
  return data;
}

// ---------- Steadfast ----------
const SF = 'https://portal.packzy.com/api/v1';
const sfHeaders = (s: CourierSettings['steadfast']) => {
  if (!s.api_key || !s.secret_key) throw new CourierError('Steadfast API key and secret are not set (Settings → Courier).');
  return { 'Api-Key': s.api_key, 'Secret-Key': s.secret_key, 'Content-Type': 'application/json' };
};

// ---------- Pathao ----------
const pathaoBase = (s: CourierSettings['pathao']) => (s.sandbox ? 'https://courier-api-sandbox.pathao.com' : 'https://api-hermes.pathao.com');
async function pathaoToken(s: CourierSettings['pathao']) {
  if (!s.client_id || !s.client_secret || !s.username || !s.password || !s.store_id) throw new CourierError('Pathao credentials are not complete (Settings → Courier).');
  const d = await call(`${pathaoBase(s)}/aladdin/api/v1/issue-token`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ client_id: s.client_id, client_secret: s.client_secret, grant_type: 'password', username: s.username, password: s.password }),
  });
  if (!d.access_token) throw new CourierError('Pathao sign-in failed. Check the credentials.');
  return d.access_token as string;
}

// ---------- RedX ----------
const redxBase = (s: CourierSettings['redx']) => (s.sandbox ? 'https://sandbox.redx.com.bd/v1.0.0-beta' : 'https://openapi.redx.com.bd/v1.0.0-beta');
const redxHeaders = (s: CourierSettings['redx']) => {
  if (!s.token) throw new CourierError('RedX API token is not set (Settings → Courier).');
  return { 'API-ACCESS-TOKEN': `Bearer ${s.token}`, 'Content-Type': 'application/json' };
};

export async function book(courier: CourierName, cfg: CourierSettings, p: Parcel): Promise<Booking> {
  if (courier === 'steadfast') {
    const d = await call(`${SF}/create_order`, {
      method: 'POST', headers: sfHeaders(cfg.steadfast),
      body: JSON.stringify({ invoice: p.invoice, recipient_name: p.name, recipient_phone: p.phone, recipient_address: `${p.address}${p.area ? ', ' + p.area : ''}, ${p.district}`, cod_amount: p.cod, note: p.note || '' }),
    });
    const c = d.consignment;
    if (!c) throw new CourierError(d.message || 'Steadfast did not accept the parcel.');
    return { consignment_id: String(c.consignment_id), tracking_code: String(c.tracking_code), status: String(c.status || 'in_review') };
  }
  if (courier === 'pathao') {
    const s = cfg.pathao;
    const token = await pathaoToken(s);
    const d = await call(`${pathaoBase(s)}/aladdin/api/v1/orders`, {
      method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        store_id: Number(s.store_id), merchant_order_id: p.invoice, recipient_name: p.name, recipient_phone: p.phone,
        recipient_address: `${p.address}${p.area ? ', ' + p.area : ''}, ${p.district}`, delivery_type: 48, item_type: 2,
        special_instruction: p.note || '', item_quantity: p.items, item_weight: 0.5, amount_to_collect: p.cod, item_description: p.description.slice(0, 250),
      }),
    });
    const c = d.data;
    if (!c?.consignment_id) throw new CourierError(d.message || 'Pathao did not accept the parcel.');
    return { consignment_id: String(c.consignment_id), tracking_code: String(c.consignment_id), status: String(c.order_status || 'Pending') };
  }
  if (courier === 'redx') {
    const s = cfg.redx;
    const areas = await call(`${redxBase(s)}/areas?district_name=${encodeURIComponent(p.district)}`, { headers: redxHeaders(s) });
    const list: any[] = areas.areas || [];
    const wanted = (p.area || '').toLowerCase();
    const area = (wanted && list.find((a) => wanted.includes(String(a.name).toLowerCase()) || String(a.name).toLowerCase().includes(wanted))) || list[0];
    if (!area) throw new CourierError(`RedX has no delivery area for ${p.district}.`);
    const d = await call(`${redxBase(s)}/parcel`, {
      method: 'POST', headers: redxHeaders(s),
      body: JSON.stringify({
        customer_name: p.name, customer_phone: p.phone, delivery_area: area.name, delivery_area_id: area.id, customer_address: `${p.address}, ${p.district}`,
        merchant_invoice_id: p.invoice, cash_collection_amount: String(p.cod), parcel_weight: 500, instruction: p.note || '', value: p.cod,
      }),
    });
    if (!d.tracking_id) throw new CourierError(d.message || 'RedX did not accept the parcel.');
    return { consignment_id: String(d.tracking_id), tracking_code: String(d.tracking_id), status: 'pickup-pending' };
  }
  throw new CourierError('Unknown courier.');
}

/** Returns the courier's current status text for a consignment. */
export async function status(courier: CourierName, cfg: CourierSettings, consignmentId: string): Promise<string> {
  if (courier === 'steadfast') {
    const d = await call(`${SF}/status_by_cid/${encodeURIComponent(consignmentId)}`, { headers: sfHeaders(cfg.steadfast) });
    return String(d.delivery_status || 'unknown');
  }
  if (courier === 'pathao') {
    const token = await pathaoToken(cfg.pathao);
    const d = await call(`${pathaoBase(cfg.pathao)}/aladdin/api/v1/orders/${encodeURIComponent(consignmentId)}/info`, { headers: { Authorization: `Bearer ${token}` } });
    return String(d.data?.order_status || 'unknown');
  }
  if (courier === 'redx') {
    const d = await call(`${redxBase(cfg.redx)}/parcel/info/${encodeURIComponent(consignmentId)}`, { headers: redxHeaders(cfg.redx) });
    return String(d.parcel?.status || 'unknown');
  }
  throw new CourierError('Unknown courier.');
}

export const isDelivered = (s: string) => /^delivered|delivered$|^delivery[_ ]?success/i.test(s.trim());

export function trackingUrl(courier: string, code: string) {
  if (courier === 'steadfast') return `https://steadfast.com.bd/t/${encodeURIComponent(code)}`;
  if (courier === 'pathao') return `https://merchant.pathao.com/tracking?consignment_id=${encodeURIComponent(code)}`;
  if (courier === 'redx') return `https://redx.com.bd/track-parcel/?trackingId=${encodeURIComponent(code)}`;
  return null;
}
