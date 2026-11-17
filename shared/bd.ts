// Bangladesh-specific helpers shared by the store and the admin.

export const DIVISIONS: Record<string, string[]> = {
  Dhaka: ['Dhaka', 'Faridpur', 'Gazipur', 'Gopalganj', 'Kishoreganj', 'Madaripur', 'Manikganj', 'Munshiganj', 'Narayanganj', 'Narsingdi', 'Rajbari', 'Shariatpur', 'Tangail'],
  Chattogram: ['Bandarban', 'Brahmanbaria', 'Chandpur', 'Chattogram', "Cox's Bazar", 'Cumilla', 'Feni', 'Khagrachhari', 'Lakshmipur', 'Noakhali', 'Rangamati'],
  Rajshahi: ['Bogura', 'Chapai Nawabganj', 'Joypurhat', 'Naogaon', 'Natore', 'Pabna', 'Rajshahi', 'Sirajganj'],
  Khulna: ['Bagerhat', 'Chuadanga', 'Jashore', 'Jhenaidah', 'Khulna', 'Kushtia', 'Magura', 'Meherpur', 'Narail', 'Satkhira'],
  Barishal: ['Barguna', 'Barishal', 'Bhola', 'Jhalokati', 'Patuakhali', 'Pirojpur'],
  Sylhet: ['Habiganj', 'Moulvibazar', 'Sunamganj', 'Sylhet'],
  Rangpur: ['Dinajpur', 'Gaibandha', 'Kurigram', 'Lalmonirhat', 'Nilphamari', 'Panchagarh', 'Rangpur', 'Thakurgaon'],
  Mymensingh: ['Jamalpur', 'Mymensingh', 'Netrokona', 'Sherpur'],
};
export const DISTRICTS: string[] = Object.values(DIVISIONS).flat().sort((a, b) => a.localeCompare(b));

export type Zone = 'inside_dhaka' | 'sub_dhaka' | 'outside_dhaka';
export const ZONE_LABEL: Record<Zone, string> = {
  inside_dhaka: 'Inside Dhaka city',
  sub_dhaka: 'Dhaka sub-area (Savar, Keraniganj, Gazipur, Narayanganj)',
  outside_dhaka: 'Outside Dhaka',
};

/** Zone for a district. In Dhaka district the customer may pick city or sub-area. */
export function zoneFor(district: string, requested?: string): Zone {
  if (district === 'Dhaka') return requested === 'sub_dhaka' ? 'sub_dhaka' : 'inside_dhaka';
  if (district === 'Gazipur' || district === 'Narayanganj') return 'sub_dhaka';
  return 'outside_dhaka';
}

/** Normalises BD mobile numbers to 01XXXXXXXXX, or returns null when invalid. */
export function normalizePhone(input: string): string | null {
  let d = String(input || '').replace(/[^\d]/g, '');
  if (d.startsWith('880')) d = d.slice(2);
  else if (d.startsWith('88')) d = d.slice(2);
  if (d.length === 10 && d.startsWith('1')) d = '0' + d;
  return /^01[3-9]\d{8}$/.test(d) ? d : null;
}

export const taka = (n: number) => '৳' + Math.round(Number(n) || 0).toLocaleString('en-IN');

export type DeliverySettings = { inside_dhaka: number; sub_dhaka: number; outside_dhaka: number; free_over?: number; inside_days?: string; outside_days?: string };

export type Coupon = {
  code: string; type: 'percent' | 'fixed' | 'free_delivery'; value: number; min_order: number;
  max_discount: number | null; starts_at: string | null; ends_at: string | null; usage_limit: number | null; used: number; status: string;
};

export function couponProblem(c: Coupon | null, subtotal: number, now = new Date()): string | null {
  if (!c || c.status !== 'active') return 'This coupon code is not valid.';
  if (c.starts_at && new Date(c.starts_at) > now) return 'This coupon is not active yet.';
  if (c.ends_at && new Date(c.ends_at) < now) return 'This coupon has expired.';
  if (c.usage_limit != null && c.used >= c.usage_limit) return 'This coupon has reached its usage limit.';
  if (subtotal < (c.min_order || 0)) return `This coupon needs a minimum order of ${taka(c.min_order)}.`;
  return null;
}

export type OfferSettings = { enabled: boolean; tiers: { min_qty: number; percent: number }[] };
export type RewardSettings = { enabled: boolean; earn_per_100: number; point_value: number; max_redeem_percent: number; min_redeem: number };

/** Best "buy more, save more" tier for a number of items. */
export function offerTier(qty: number, offers?: OfferSettings | null) {
  if (!offers?.enabled) return null;
  return [...(offers.tiers || [])].sort((a, b) => b.min_qty - a.min_qty).find((t) => qty >= t.min_qty) || null;
}

/**
 * Order of discounts: quantity offer → coupon → reward points; then delivery.
 * All amounts are whole Taka.
 */
export function priceOrder(input: {
  subtotal: number; qty: number; zone: Zone; delivery: DeliverySettings; coupon: Coupon | null;
  offers?: OfferSettings | null; rewards?: RewardSettings | null; pointsAvailable?: number; pointsWanted?: number;
}) {
  const { subtotal, qty, zone, delivery, coupon, offers, rewards } = input;
  const tier = offerTier(qty, offers);
  const offerDiscount = tier ? Math.floor((subtotal * tier.percent) / 100) : 0;
  const afterOffer = subtotal - offerDiscount;

  let deliveryFee = Number(delivery[zone]) || 0;
  if (delivery.free_over && subtotal >= delivery.free_over) deliveryFee = 0;
  let couponDiscount = 0;
  if (coupon) {
    if (coupon.type === 'percent') couponDiscount = Math.floor((afterOffer * coupon.value) / 100);
    else if (coupon.type === 'fixed') couponDiscount = coupon.value;
    else if (coupon.type === 'free_delivery') deliveryFee = 0;
    if (coupon.max_discount != null && couponDiscount > coupon.max_discount) couponDiscount = coupon.max_discount;
    couponDiscount = Math.min(couponDiscount, afterOffer);
  }
  const afterCoupon = afterOffer - couponDiscount;

  let pointsUsed = 0, pointsDiscount = 0;
  if (rewards?.enabled && input.pointsWanted && input.pointsAvailable) {
    const value = rewards.point_value || 1;
    const cap = Math.floor((afterCoupon * (rewards.max_redeem_percent || 0)) / 100 / value);
    pointsUsed = Math.max(0, Math.min(input.pointsWanted, input.pointsAvailable, cap));
    if (pointsUsed < (rewards.min_redeem || 0)) pointsUsed = 0;
    pointsDiscount = pointsUsed * value;
  }
  const discount = couponDiscount + pointsDiscount;
  const total = afterCoupon - pointsDiscount + deliveryFee;
  const freeDeliveryLeft = delivery.free_over && subtotal < delivery.free_over ? delivery.free_over - subtotal : 0;
  return { subtotal, offerDiscount, offerPercent: tier?.percent || 0, couponDiscount, pointsUsed, pointsDiscount, discount, deliveryFee, total, freeDeliveryLeft };
}

export const pointsEarned = (total: number, r?: RewardSettings | null) => (r?.enabled ? Math.floor((total / 100) * (r.earn_per_100 || 0)) : 0);

export const ORDER_STATUSES = ['pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled', 'returned'] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];
export const STATUS_LABEL: Record<OrderStatus, string> = {
  pending: 'Pending', confirmed: 'Confirmed', processing: 'Packing', shipped: 'Shipped', delivered: 'Delivered', cancelled: 'Cancelled', returned: 'Returned',
};
/** Statuses that hold stock (stock is released when moving to cancelled/returned). */
export const STOCK_HOLDING: OrderStatus[] = ['pending', 'confirmed', 'processing', 'shipped', 'delivered'];
