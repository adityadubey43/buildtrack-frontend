"use client";

import { useEffect, useState } from "react";
import { BarChart3, TrendingUp, TrendingDown, Users, DollarSign, Clock, Loader2 } from "lucide-react";
import { api, type Analytics } from "@/lib/api";

export default function AnalyticsPage() {
  const [data, setData] = useState<Analytics | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.dashboard.analytics()
      .then((r) => setData(r.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) return (
    <div className="p-6 flex items-center justify-center min-h-64">
      <Loader2 className="w-6 h-6 animate-spin text-orange-500" />
    </div>
  );

  if (!data) return (
    <div className="p-6 text-slate-500 text-sm">Failed to load analytics. Please try again.</div>
  );

  const revenue = data.monthlyRevenue ?? [];
  const projects = data.projectPerformance ?? [];
  const workers = data.workerDistribution ?? [];

  const maxRev = revenue.length
    ? Math.max(...revenue.map((m) => m.revenue), 1)
    : 1;

  const totalRevenue = revenue.reduce((s, m) => s + m.revenue, 0);
  const totalWorkers = workers.reduce((s, w) => s + w.count, 0);

  return (
    <div className="p-4 lg:p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Analytics & Reports</h1>
        <p className="text-slate-500 text-sm">Live performance data from your projects</p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Total Revenue", value: `₹${(totalRevenue / 100000).toFixed(1)}L`, icon: DollarSign, color: "text-green-600", bg: "bg-green-50" },
          { label: "Total Workers", value: totalWorkers.toString(), icon: Users, color: "text-blue-600", bg: "bg-blue-50" },
          { label: "Active Projects", value: projects.length.toString(), icon: Clock, color: "text-orange-600", bg: "bg-orange-50" },
          { label: "Over Budget", value: projects.filter(p => p.amountSpent > p.budget).length.toString(), icon: TrendingUp, color: "text-red-600", bg: "bg-red-50" },
        ].map((kpi) => (
          <div key={kpi.label} className="bg-white rounded-2xl border border-slate-100 p-5 shadow-sm">
            <div className={`w-10 h-10 ${kpi.bg} rounded-xl flex items-center justify-center mb-3`}>
              <kpi.icon className={`w-5 h-5 ${kpi.color}`} />
            </div>
            <div className="text-xl font-bold text-slate-900">{kpi.value}</div>
            <div className="text-xs text-slate-500 mt-0.5">{kpi.label}</div>
          </div>
        ))}
      </div>

      {/* Revenue chart */}
      {revenue.length > 0 && (
        <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-sm">
          <h2 className="font-bold text-slate-900 mb-5">Monthly Revenue (₹)</h2>
          <div className="flex items-end gap-4 h-48">
            {revenue.map((m) => {
              const monthNames = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
              const label = `${monthNames[(m._id.month ?? 1) - 1]} ${String(m._id.year).slice(2)}`;
              return (
                <div key={label} className="flex-1 flex flex-col items-center gap-1">
                  <div className="w-full flex items-end justify-center" style={{ height: "160px" }}>
                    <div
                      className="w-full bg-orange-500 rounded-t-lg transition-all"
                      style={{ height: `${(m.revenue / maxRev) * 160}px` }}
                      title={`₹${m.revenue.toLocaleString("en-IN")}`}
                    />
                  </div>
                  <div className="text-xs text-slate-500">{label}</div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Project performance */}
      {projects.length > 0 && (
        <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-sm">
          <h2 className="font-bold text-slate-900 mb-4">Project Performance</h2>
          <div className="space-y-4">
            {projects.map((p) => {
              const budgetUsed = p.budget > 0 ? (p.amountSpent / p.budget) * 100 : 0;
              return (
                <div key={p.name} className="grid grid-cols-3 gap-4 items-center py-3 border-b border-slate-50 last:border-0">
                  <div className="font-semibold text-slate-800 text-sm truncate">{p.name}</div>
                  <div>
                    <div className="text-xs text-slate-500 mb-1">Progress</div>
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                        <div className="h-full bg-orange-500 rounded-full" style={{ width: `${p.overallProgress}%` }} />
                      </div>
                      <span className="text-xs font-bold text-slate-700">{p.overallProgress}%</span>
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-slate-500 mb-1">Budget Used</div>
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                        <div className={`h-full rounded-full ${budgetUsed > 90 ? "bg-red-500" : budgetUsed > 70 ? "bg-yellow-500" : "bg-green-500"}`}
                          style={{ width: `${Math.min(budgetUsed, 100)}%` }} />
                      </div>
                      <span className="text-xs font-bold text-slate-700">{budgetUsed.toFixed(0)}%</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Worker distribution */}
      {workers.length > 0 && (
        <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-sm">
          <h2 className="font-bold text-slate-900 mb-4">Worker Distribution by Role</h2>
          <div className="flex flex-wrap gap-3">
            {workers.map((w) => (
              <div key={w._id} className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl px-4 py-2">
                <div className="w-2 h-2 bg-orange-500 rounded-full" />
                <span className="text-sm text-slate-700 capitalize">{w._id || "Unknown"}</span>
                <span className="text-sm font-bold text-slate-900">{w.count}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {workers.length === 0 && projects.length === 0 && revenue.length === 0 && (
        <div className="bg-slate-50 rounded-2xl border border-slate-200 p-10 text-center">
          <BarChart3 className="w-10 h-10 text-slate-300 mx-auto mb-3" />
          <p className="text-slate-500 font-medium">No analytics data yet</p>
          <p className="text-slate-400 text-sm mt-1">Add projects, workers, and record payments to see analytics here.</p>
        </div>
      )}
    </div>
  );
}
