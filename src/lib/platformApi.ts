const BASE_URL = process.env.NEXT_PUBLIC_API_URL || "https://buildtrack-api-svpk.onrender.com/api";

const TOKEN_KEY = "bt_platform_token";
const ADMIN_KEY = "bt_platform_admin";

export interface PlatformAdmin {
  id: string;
  name: string;
  email: string;
  role: string;
}

export function getPlatformToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(TOKEN_KEY);
}
export function setPlatformToken(t: string) { localStorage.setItem(TOKEN_KEY, t); }
export function getPlatformAdmin(): PlatformAdmin | null {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem(ADMIN_KEY);
  return raw ? (JSON.parse(raw) as PlatformAdmin) : null;
}
export function setPlatformAdmin(a: PlatformAdmin) { localStorage.setItem(ADMIN_KEY, JSON.stringify(a)); }
export function clearPlatform() { localStorage.removeItem(TOKEN_KEY); localStorage.removeItem(ADMIN_KEY); }

async function preq<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getPlatformToken();
  const res = await fetch(`${BASE_URL}/platform${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || "Request failed");
  return data as T;
}

export const platformApi = {
  login: (body: { email: string; password: string }) =>
    preq<{ success: boolean; token: string; admin: PlatformAdmin }>("/auth/login", { method: "POST", body: JSON.stringify(body) }),
  me: () => preq<{ success: boolean; admin: PlatformAdmin }>("/auth/me"),
  stats: () => preq<{ success: boolean; data: PlatformStats }>("/stats"),
  companies: (params?: Record<string, string>) => {
    const qs = params ? "?" + new URLSearchParams(params).toString() : "";
    return preq<{ success: boolean; count: number; data: Company[] }>(`/companies${qs}`);
  },
  updateCompany: (tenantId: string, body: { isActive?: boolean; plan?: string; planStatus?: string; extendTrialDays?: number }) =>
    preq<{ success: boolean; message: string }>(`/companies/${tenantId}`, { method: "PATCH", body: JSON.stringify(body) }),
  getPricing: () =>
    preq<{ success: boolean; data: PricingData }>("/pricing"),
  setPricing: (body: Partial<{ basic: number; pro: number; enterprise: number; yearlyDiscount: number }>) =>
    preq<{ success: boolean; message: string; data: PricingData }>("/pricing", { method: "PUT", body: JSON.stringify(body) }),
};

export interface Company {
  tenantId: string;
  companyName: string;
  slug?: string;
  plan: string;
  planStatus: string;
  isActive: boolean;
  trialEndsAt?: string;
  subscriptionStartedAt?: string;
  subscriptionEndsAt?: string;
  billingCycle?: "monthly" | "yearly";
  createdAt: string;
  users: number;
  projects: number;
  amountPaid: number;   // actual amount paid (yearly full price or monthly price)
  mrr: number;          // monthly equivalent
}

export interface PricingData {
  monthly: { basic: number; pro: number; enterprise: number };
  yearly:  { basic: number; pro: number; enterprise: number };
  yearlyDiscount: number;
}

export interface PlatformStats {
  totalCompanies: number;
  newThisMonth: number;
  activeClients: number;
  byStatus: { trial: number; active: number; expired: number; cancelled: number };
  byPlan: { basic: number; pro: number; enterprise: number };
  mrr: number;
  trialPipeline: number;
  usage: { totalUsers: number; totalWorkers: number; totalProjects: number };
  trialsEndingSoon: { _id: string; companyName: string; slug?: string; trialEndsAt: string; plan: string }[];
  recentCompanies: { _id: string; companyName: string; slug?: string; plan: string; planStatus: string; createdAt: string }[];
  monthlySignups: { label: string; count: number }[];
  planPrices: { basic: number; pro: number; enterprise: number };
}
