// SMS sending for OTP codes and customer notifications (Bangladesh gateways).
// Configure in admin → Settings → SMS. Provider "none" means SMS is switched off.
import { getSetting } from './orders';

export type SmsSettings = { provider: 'none' | 'bulksmsbd' | 'custom'; api_key: string; sender_id: string; url_template: string };
export const DEFAULT_SMS: SmsSettings = { provider: 'none', api_key: '', sender_id: '', url_template: '' };

export async function smsEnabled(db: D1Database) {
  const s = await getSetting<SmsSettings>(db, 'sms', DEFAULT_SMS);
  return s.provider !== 'none' ? s : null;
}

/** Sends one SMS. `phone` is a normalised 01XXXXXXXXX number. Returns false if SMS is not configured or fails. */
export async function sendSms(db: D1Database, phone: string, message: string): Promise<boolean> {
  const s = await smsEnabled(db);
  if (!s) return false;
  const intl = '88' + phone;
  let url = '';
  if (s.provider === 'bulksmsbd') {
    url = `http://bulksmsbd.net/api/smsapi?api_key=${encodeURIComponent(s.api_key)}&type=text&number=${intl}&senderid=${encodeURIComponent(s.sender_id)}&message=${encodeURIComponent(message)}`;
  } else if (s.provider === 'custom' && s.url_template.startsWith('http')) {
    url = s.url_template.replace('{phone}', intl).replace('{phone_local}', phone).replace('{message}', encodeURIComponent(message)).replace('{api_key}', encodeURIComponent(s.api_key)).replace('{sender_id}', encodeURIComponent(s.sender_id));
  }
  if (!url) return false;
  try {
    const r = await fetch(url, { method: 'GET' });
    return r.ok;
  } catch (e) {
    console.error('sms failed', e);
    return false;
  }
}
