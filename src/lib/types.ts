export type UserRole = "customer" | "admin";

export interface Profile {
  id: string;
  email: string;
  full_name: string | null;
  role: UserRole;
  created_at: string;
}

export interface Wallet {
  user_id: string;
  balance_cents: number;
  updated_at: string;
}

export type WalletTxType = "topup" | "purchase" | "refund" | "adjustment";

export interface WalletTransaction {
  id: string;
  user_id: string;
  type: WalletTxType;
  amount_cents: number;
  balance_after_cents: number;
  description: string | null;
  related_rental_id: string | null;
  related_topup_id: string | null;
  related_order_id: string | null;
  created_by: string | null;
  created_at: string;
}

export type TopupStatus = "pending" | "approved" | "rejected";

export interface TopupRequest {
  id: string;
  user_id: string;
  amount_cents: number;
  method: string;
  reference: string | null;
  status: TopupStatus;
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string;
}

export type RentalStatus = "waiting" | "received" | "cancelled" | "done" | "expired";
export type RentalProvider = "daisysms" | "daisysim" | "daisysim2";

export interface Rental {
  id: string;
  user_id: string;
  provider: RentalProvider;
  external_id: string;
  service: string;
  country: string | null;
  phone: string;
  price_cents: number;
  status: RentalStatus;
  code: string | null;
  full_text: string | null;
  created_at: string;
  updated_at: string;
}

export interface Announcement {
  id: string;
  message: string;
  active: boolean;
  created_by: string | null;
  created_at: string;
}

export interface DaisySimCountry {
  id: number;
  name: string;
}

export interface DaisySimService {
  code: string;
  name: string;
}

export interface DaisySimTier {
  tier: number;
  price: number;
  available: number;
}

export interface Category {
  id: string;
  name: string;
  description: string | null;
  created_by: string | null;
  created_at: string;
}

export interface ProductTemplate {
  id: string;
  category_id: string | null;
  name: string;
  description: string | null;
  price_cents: number;
  available_count: number;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface ProductOrder {
  id: string;
  user_id: string;
  product_template_id: string;
  stock_item_id: string;
  price_cents: number;
  created_at: string;
}

export interface DeliveredCredentials {
  email: string | null;
  username: string | null;
  password: string;
  email_password: string | null;
  two_fa: string | null;
  recovery_email: string | null;
  recovery_email_password: string | null;
  extra_field_1: string | null;
  extra_field_2: string | null;
}

/** Format cents as a dollar string, e.g. 1050 -> "$10.50" */
export function formatCents(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

/** Format cents as a naira string, e.g. 250000 -> "₦2,500.00" */
export function formatNaira(cents: number): string {
  return `₦${(cents / 100).toLocaleString("en-NG", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
