export type ProfileType = "personal" | "business";
export type TransactionType = "income" | "expense";

export interface User {
  id: string;
  telegram_username: string | null;
  first_name: string | null;
  profile_type: ProfileType | null;
  is_admin: boolean;
}

export type PaymentPlanKind = "monthly" | "yearly";
export type PaymentMethod = "telebirr" | "cbe" | "awash" | "other";
export type PaymentSubmissionStatus = "pending" | "approved" | "rejected";

export interface PaymentAccountDetails {
  telebirr_number: string;
  telebirr_name: string;
  cbe_account: string;
  awash_account: string;
}

export interface PlansResponse {
  price_monthly_birr: number;
  price_yearly_birr: number;
  payment_details: PaymentAccountDetails;
}

export interface PaymentSubmission {
  id: string;
  plan: PaymentPlanKind;
  amount: string;
  method: PaymentMethod;
  sender_name: string;
  transaction_id: string;
  screenshot_url: string | null;
  status: PaymentSubmissionStatus;
  submitted_at: string;
  reviewed_at: string | null;
  telegram_username: string | null;
}

export interface Account {
  id: string;
  name: string;
  type: "cash" | "bank" | "card" | "mobile_wallet";
  is_default: boolean;
}

export interface Category {
  id: string;
  name: string;
  icon: string | null;
  type: TransactionType;
}

export interface Transaction {
  id: string;
  amount: string;
  type: TransactionType;
  category_id: string;
  account_id: string;
  note: string | null;
  is_credit: boolean;
  created_at: string;
}

export interface TodayResponse {
  transactions: Transaction[];
  count_today: number;
  free_daily_cap: number;
  is_free_tier: boolean;
  cap_reached: boolean;
}

export interface LoginInitResponse {
  token: string;
  deep_link: string;
  expires_in_seconds: number;
}

export interface LoginPollResponse {
  status: "pending" | "confirmed" | "expired";
  access_token?: string | null;
  is_new_user?: boolean | null;
}
