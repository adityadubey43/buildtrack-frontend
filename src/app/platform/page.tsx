"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  platformApi, getPlatformToken, getPlatformAdmin, clearPlatform,
  type PlatformStats, type Company,
} from "@/lib/platformApi";
import {
  ShieldCheck, Building2, TrendingUp, Users, Wallet, LogOut, AlertTriangle,
  Clock, Search, Briefcase, Layers,
} from "lucide-react";

function formatINR(n: number) {
  if (n >= 10000000) return `₹${(n / 10000000).toFixed(2)} Cr`;
  if (n >= 100000) return `₹${(n / 100000).toFixed(2)} L`;
  return `₹${n.toLocaleString("en-IN")}`;
}
function fmtDate(d?: string) { return d ? new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "—"; }

const STATUS_CLS: Record<string, string> = {
  trial: "bg-yellow-100 text-yellow-700",
  active: "bg-green-100 text-green-700",
  expired: "bg-red-100 text-red-700",
  cancelled: "bg-slate-200 text-slate-600",
};
const PLAN_CLS: Record<string, string> = {
  basic: "bg-slate-100 text-slate-700",
  pro: "bg-orange-100 text-orange-700",
  enterprise: "bg-purple-100 text-purple-700",
};

export default function PlatformDashboard() {
  const router = useRouter();
  const [stats, setStats] = useState<PlatformStats | null>(null);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [adminName, setAdminName] = useState("");

  useEffect(() => {
    if (!getPlatformToken()) { router.replace("/platform/login"); return; }
    setAdminName(getPlatformAdmin()?.name || "");
  }, [router]);

  const load = useCallback(async () => {
    try {
      const params: Record<string, string> = {};
      if (statusFilter) params.status = statusFilter;
      if (search) params.search = search;
      const [s, c] = await Promise.all([platformApi.stats(), platformApi.companies(params)]);
      setStats(s.data);
      setCompanies(c.data);
    } catch (e: unknown) {
      if (e instanceof Error && /token|auth/i.test(e.message)) { clearPlatform(); router.replace("/platform/login"); }
    } finally { setLoading(false); }
  }, [statusFilter, search, router]);

  useEffect(() => { if (getPlatformToken()) load(); }, [load]);

  const act = async (tenantId: string, body: Parameters<typeof platformApi.updateCompany>[1]) => {
    try { await platformApi.updateCompany(tenantId, body); await load(); }
    catch { alert("Action failed."); }
  };

  const logout = () => { clearPlatform(); router.push("/platform/login"); };

  if (loading) {
    return <div className="min-h-screen bg-slate-50 flex items-center justify-center"><div className="w-8 h-8 border-4 border-orange-500 border-t-transparent rounded-full animate-spin" /></div>;
  }

  const maxSignup = Math.max(1, ...(stats?.monthlySignups.map((m) => m.count) || [1]));

  const METRICS = stats ? [
    { label: "Companies", value: String(stats.totalCompanies), sub: `+${stats.newThisMonth} this month`, icon: Building2, color: "text-orange-600", bg: "bg-orange-50" },
    { label: "MRR", value: formatINR(stats.mrr), sub: `${formatINR((stats as any).totalRevenue || 0)} collected`, icon: Wallet, color: "text-green-600", bg: "bg-green-50" },
    { label: "Active Clients", value: String(stats.activeClients), sub: `${stats.byStatus.trial} on trial`, icon: TrendingUp, color: "text-blue-600", bg: "bg-blue-50" },
    { label: "Platform Users", value: String(stats.usage.totalUsers), sub: `${stats.usage.totalProjects} projects`, icon: Users, color: "text-purple-600", bg: "bg-purple-50" },
  ] : [];

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Top bar */}
      <header className="bg-slate-900 text-white">
        <div className="max-w-7xl mx-auto px-4 lg:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-orange-500 rounded-lg flex items-center justify-center"><ShieldCheck className="w-5 h-5" /></div>
            <span className="font-bold">Build<span className="text-orange-500">Track</span> <span className="text-slate-400 font-normal">Platform</span></span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm text-slate-300 hidden sm:block">{adminName}</span>
            <button onClick={logout} className="flex items-center gap-1.5 text-sm text-slate-400 hover:text-white"><LogOut className="w-4 h-4" /> Sign out</button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 lg:px-6 py-6 space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Business Overview</h1>
          <p className="text-slate-500 text-sm">Everything across all BuildTrack companies</p>
        </div>

        {/* Metrics */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {METRICS.map((m) => (
            <div key={m.label} className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100">
              <div className={`w-10 h-10 ${m.bg} rounded-xl flex items-center justify-center mb-3`}><m.icon className={`w-5 h-5 ${m.color}`} /></div>
              <div className="text-2xl font-bold text-slate-900">{m.value}</div>
              <div className="text-slate-500 text-xs mt-0.5">{m.label}</div>
              <div className="text-xs text-slate-400 mt-1">{m.sub}</div>
            </div>
          ))}
        </div>

        <div className="grid lg:grid-cols-3 gap-6">
          {/* Subscriptions + plans */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5">
            <h3 className="font-bold text-slate-900 mb-4">Subscriptions</h3>
            <div className="space-y-2.5">
              {stats && Object.entries(stats.byStatus).map(([k, v]) => (
                <div key={k} className="flex items-center justify-between">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium capitalize ${STATUS_CLS[k]}`}>{k}</span>
                  <span className="font-bold text-slate-800">{v}</span>
                </div>
              ))}
            </div>
            <div className="border-t border-slate-100 mt-4 pt-4">
              <h4 className="text-xs font-semibold text-slate-400 uppercase mb-2">By Plan</h4>
              <div className="space-y-2.5">
                {stats && Object.entries(stats.byPlan).map(([k, v]) => (
                  <div key={k} className="flex items-center justify-between">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium capitalize ${PLAN_CLS[k]}`}>{k}</span>
                    <span className="font-bold text-slate-800">{v}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Signups chart */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5 lg:col-span-2">
            <h3 className="font-bold text-slate-900 mb-4">New Companies (last 6 months)</h3>
            <div className="flex items-end gap-3 h-40">
              {stats?.monthlySignups.length ? stats.monthlySignups.map((m) => (
                <div key={m.label} className="flex-1 flex flex-col items-center gap-1">
                  <div className="w-full bg-orange-500 rounded-t-lg transition-all" style={{ height: `${(m.count / maxSignup) * 140}px` }} title={`${m.count}`} />
                  <span className="text-xs text-slate-400">{m.label}</span>
                  <span className="text-xs font-semibold text-slate-700">{m.count}</span>
                </div>
              )) : <p className="text-sm text-slate-400">No data yet.</p>}
            </div>
          </div>
        </div>

        {/* Trials ending soon */}
        {stats && stats.trialsEndingSoon.length > 0 && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-2xl p-5">
            <div className="flex items-center gap-2 mb-3 text-yellow-700"><Clock className="w-4 h-4" /><h3 className="font-bold text-sm">Trials ending soon ({stats.trialsEndingSoon.length})</h3></div>
            <div className="flex flex-wrap gap-2">
              {stats.trialsEndingSoon.map((t) => (
                <span key={t._id} className="text-xs bg-white border border-yellow-200 rounded-lg px-3 py-1.5 text-slate-700">
                  {t.companyName} · {fmtDate(t.trialEndsAt)}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Companies table */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-5 border-b border-slate-100">
            <h3 className="font-bold text-slate-900">All Companies ({companies.length})</h3>
            <div className="flex gap-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search…" className="pl-9 pr-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-400" />
              </div>
              <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="border border-slate-200 rounded-lg px-2.5 py-2 text-sm">
                <option value="">All status</option>
                <option value="trial">Trial</option>
                <option value="active">Active</option>
                <option value="expired">Expired</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-slate-400 border-b border-slate-100 bg-slate-50">
                  <th className="py-3 px-4 font-medium">Company</th>
                  <th className="py-3 px-3 font-medium">Plan / Status</th>
                  <th className="py-3 px-3 font-medium">Amount Paid</th>
                  <th className="py-3 px-3 font-medium">Subscribed On</th>
                  <th className="py-3 px-3 font-medium">Active Until</th>
                  <th className="py-3 px-3 font-medium">Usage</th>
                  <th className="py-3 px-3 font-medium">Manage</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {companies.map((c) => {
                  const endsAt     = c.subscriptionEndsAt || (c.planStatus === "active" ? c.trialEndsAt : undefined);
                  const daysLeft   = endsAt ? Math.max(0, Math.ceil((new Date(endsAt).getTime() - Date.now()) / 86400000)) : null;
                  // Yearly = has an end date AND that date is more than 30 days away (trial users have short endsAt)
                  const isYearly   = c.planStatus === "active" && daysLeft !== null && daysLeft > 30;
                  const startedAt  = c.subscriptionStartedAt;
                  const isExpiring = daysLeft !== null && daysLeft <= 7 && c.planStatus === "active";

                  return (
                    <tr key={c.tenantId} className={`hover:bg-slate-50 ${!c.isActive ? "opacity-40" : ""}`}>

                      {/* Company */}
                      <td className="py-3 px-4">
                        <div className="font-semibold text-slate-800">{c.companyName}</div>
                        <div className="text-xs text-slate-400 mt-0.5">/c/{c.slug || "—"}</div>
                      </td>

                      {/* Plan + Status */}
                      <td className="py-3 px-3">
                        <div className="flex items-center gap-1.5 mb-1">
                          <select value={c.plan} onChange={(e) => act(c.tenantId, { plan: e.target.value })}
                            className={`text-xs px-2 py-1 rounded-full font-medium capitalize border-0 cursor-pointer ${PLAN_CLS[c.plan]}`}>
                            <option value="basic">basic</option>
                            <option value="pro">pro</option>
                            <option value="enterprise">enterprise</option>
                          </select>
                        </div>
                        <select value={c.planStatus} onChange={(e) => act(c.tenantId, { planStatus: e.target.value })}
                          className={`text-xs px-2 py-1 rounded-full font-medium capitalize border-0 cursor-pointer ${STATUS_CLS[c.planStatus]}`}>
                          <option value="trial">trial</option>
                          <option value="active">active</option>
                          <option value="expired">expired</option>
                          <option value="cancelled">cancelled</option>
                        </select>
                      </td>

                      {/* Amount Paid */}
                      <td className="py-3 px-3">
                        {c.amountPaid ? (
                          <div>
                            <div className="font-bold text-green-600 text-base">{formatINR(c.amountPaid)}</div>
                            <div className="flex items-center gap-1 mt-0.5">
                              <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${isYearly ? "bg-purple-100 text-purple-700" : "bg-blue-100 text-blue-700"}`}>
                                {isYearly ? "Yearly" : "Monthly"}
                              </span>
                              {isYearly && (
                                <span className="text-xs text-slate-400">({formatINR(Math.round(c.amountPaid / 12))}/mo equiv.)</span>
                              )}
                            </div>
                          </div>
                        ) : (
                          <span className="text-slate-400 text-xs">{c.planStatus === "trial" ? "Trial (no charge)" : "—"}</span>
                        )}
                      </td>

                      {/* Subscribed On */}
                      <td className="py-3 px-3">
                        {startedAt ? (
                          <div>
                            <div className="text-slate-800 font-medium">{fmtDate(startedAt)}</div>
                            <div className="text-xs text-slate-400">activation date</div>
                          </div>
                        ) : c.planStatus === "trial" ? (
                          <div>
                            <div className="text-slate-800 font-medium">{fmtDate(c.createdAt)}</div>
                            <div className="text-xs text-slate-400">trial started</div>
                          </div>
                        ) : <span className="text-slate-400">—</span>}
                      </td>

                      {/* Active Until */}
                      <td className="py-3 px-3">
                        {c.planStatus === "active" && !isYearly ? (
                          <div>
                            <div className="text-blue-600 font-medium text-xs">Auto-renews monthly</div>
                            <div className="text-xs text-slate-400">via Razorpay</div>
                          </div>
                        ) : endsAt ? (
                          <div>
                            <div className={`font-semibold ${isExpiring ? "text-red-600" : "text-slate-800"}`}>
                              {fmtDate(endsAt)}
                            </div>
                            <div className={`text-xs mt-0.5 ${isExpiring ? "text-red-500 font-medium" : "text-slate-400"}`}>
                              {daysLeft === 0 ? "⚠️ Expires today" :
                               daysLeft === 1 ? "⚠️ 1 day left" :
                               isExpiring ? `⚠️ ${daysLeft} days left` :
                               `${daysLeft} days remaining`}
                            </div>
                          </div>
                        ) : <span className="text-slate-400 text-xs">—</span>}
                      </td>

                      {/* Usage */}
                      <td className="py-3 px-3">
                        <div className="flex items-center gap-3 text-xs text-slate-600">
                          <div className="flex items-center gap-1"><Briefcase className="w-3 h-3" />{c.projects}</div>
                          <div className="flex items-center gap-1"><Layers className="w-3 h-3" />{c.users}</div>
                        </div>
                      </td>

                      {/* Actions */}
                      <td className="py-3 px-3">
                        <div className="flex flex-col gap-1">
                          {c.planStatus === "trial" && (
                            <button onClick={() => act(c.tenantId, { extendTrialDays: 7 })}
                              className="text-xs px-2.5 py-1 bg-slate-100 hover:bg-slate-200 rounded-lg text-slate-600 font-medium">
                              +7 days
                            </button>
                          )}
                          <button onClick={() => act(c.tenantId, { isActive: !c.isActive })}
                            className={`text-xs px-2.5 py-1 rounded-lg font-medium ${c.isActive ? "bg-red-50 text-red-600 hover:bg-red-100" : "bg-green-50 text-green-700 hover:bg-green-100"}`}>
                            {c.isActive ? "Suspend" : "Activate"}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {companies.length === 0 && (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-slate-400">
                      <AlertTriangle className="w-8 h-8 mx-auto mb-2 opacity-30" />
                      <p className="text-sm">No companies found.</p>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <p className="text-xs text-slate-400 text-center">
          MRR = monthly equivalent of all active subscriptions. Yearly subscribers show (annual ÷ 12). "Total Collected" = actual amounts charged.
        </p>
      </main>
    </div>
  );
}
