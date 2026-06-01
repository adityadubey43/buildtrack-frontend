"use client";

import { useState, useEffect, useCallback } from "react";
import { api, type Analytics } from "@/lib/api";
import { canSeeFinance } from "@/lib/permissions";
import { getUser } from "@/lib/store";
import { BarChart3, TrendingUp, Users, AlertTriangle } from "lucide-react";

function fmt(n: number) {
  if (n >= 10000000) return `₹${(n / 10000000).toFixed(1)} Cr`;
  if (n >= 100000)   return `₹${(n / 100000).toFixed(1)} L`;
  return `₹${n.toLocaleString("en-IN")}`;
}

const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

export default function AnalyticsPage() {
  const [data, setData]     = useState<Analytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]   = useState("");
  const role = getUser()?.role || "";
  const showFinance = canSeeFinance(role);

  const load = useCallback(async () => {
    try {
      const res = await api.dashboard.analytics();
      setData(res.data);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to load analytics.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  if (loading) {
    return (
      <div className="p-6 space-y-4">
        {[1,2,3].map((i) => <div key={i} className="h-48 bg-slate-100 rounded-2xl animate-pulse" />)}
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <div className="bg-red-50 border border-red-200 rounded-xl p-5 text-center">
          <AlertTriangle className="w-8 h-8 text-red-500 mx-auto mb-2" />
          <p className="text-red-700 font-medium">{error}</p>
          <button onClick={load} className="mt-3 text-sm text-red-500 underline">Retry</button>
        </div>
      </div>
    );
  }

  const monthly   = data?.monthlyRevenue     ?? [];
  const projects  = data?.projectPerformance ?? [];
  const workers   = data?.workerDistribution ?? [];
  const maxRev    = Math.max(1, ...monthly.map((m) => m.revenue));
  const maxBudget = Math.max(1, ...projects.map((p) => p.budget || p.amountSpent));

  return (
    <div className="p-4 lg:p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Analytics</h1>
        <p className="text-slate-500 text-sm mt-0.5">Business performance overview</p>
      </div>

      {/* Monthly Revenue */}
      {showFinance && (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
          <div className="flex items-center gap-2 mb-5">
            <TrendingUp className="w-5 h-5 text-orange-500" />
            <h2 className="font-bold text-slate-900">Monthly Revenue</h2>
          </div>
          {monthly.length === 0 ? (
            <p className="text-slate-400 text-sm text-center py-8">No revenue data yet.</p>
          ) : (
            <div className="flex items-end gap-2 h-44 overflow-x-auto pb-2">
              {monthly.map((m) => {
                const pct = (m.revenue / maxRev) * 100;
                const label = `${MONTHS[(m._id.month ?? 1) - 1]} ${String(m._id.year).slice(2)}`;
                return (
                  <div key={label} className="flex-1 min-w-[44px] flex flex-col items-center gap-1">
                    <span className="text-xs text-slate-500 font-medium">{fmt(m.revenue)}</span>
                    <div className="w-full bg-orange-500 rounded-t-lg" style={{ height: `${Math.max(4, pct * 1.4)}px` }} />
                    <span className="text-xs text-slate-400 whitespace-nowrap">{label}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Project Performance */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
        <div className="flex items-center gap-2 mb-5">
          <BarChart3 className="w-5 h-5 text-orange-500" />
          <h2 className="font-bold text-slate-900">Project Performance</h2>
        </div>
        {projects.length === 0 ? (
          <p className="text-slate-400 text-sm text-center py-8">No project data yet.</p>
        ) : (
          <div className="space-y-4">
            {projects.map((p) => {
              const spentPct   = p.budget > 0 ? Math.min(100, (p.amountSpent / p.budget) * 100) : 0;
              const budgetPct  = Math.max(1, (p.budget / maxBudget) * 100);
              const overBudget = p.amountSpent > p.budget && p.budget > 0;
              return (
                <div key={p.name} className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-slate-800 truncate max-w-[60%]">{p.name}</span>
                    <div className="flex items-center gap-3 text-xs text-slate-500">
                      {showFinance && (
                        <>
                          <span className={overBudget ? "text-red-600 font-semibold" : ""}>{fmt(p.amountSpent)} spent</span>
                          <span className="text-slate-300">|</span>
                          <span>{fmt(p.budget)} budget</span>
                        </>
                      )}
                      <span className="text-orange-600 font-semibold">{p.overallProgress}%</span>
                    </div>
                  </div>
                  {/* Progress bar */}
                  <div className="h-2 bg-slate-100 rounded-full overflow-hidden" style={{ width: `${budgetPct}%` }}>
                    <div
                      className={`h-full rounded-full ${overBudget ? "bg-red-500" : "bg-orange-500"}`}
                      style={{ width: `${p.overallProgress}%` }}
                    />
                  </div>
                  {showFinance && (
                    <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden" style={{ width: `${budgetPct}%` }}>
                      <div
                        className={`h-full rounded-full ${overBudget ? "bg-red-400" : "bg-blue-400"}`}
                        style={{ width: `${spentPct}%` }}
                      />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Worker Distribution */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
        <div className="flex items-center gap-2 mb-5">
          <Users className="w-5 h-5 text-orange-500" />
          <h2 className="font-bold text-slate-900">Worker Distribution by Role</h2>
        </div>
        {workers.length === 0 ? (
          <p className="text-slate-400 text-sm text-center py-8">No worker data yet.</p>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {workers.map((w) => (
              <div key={w._id} className="bg-slate-50 rounded-xl p-4 text-center border border-slate-100">
                <div className="text-2xl font-black text-orange-500">{w.count}</div>
                <div className="text-xs text-slate-500 mt-1 capitalize">{w._id || "Unknown"}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
