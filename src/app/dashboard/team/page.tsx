"use client";

import { useState, useEffect, useCallback } from "react";
import { UserPlus, Search, Shield, Loader2, Users, RefreshCw, Trash2 } from "lucide-react";
import { api, type Worker, type Project } from "@/lib/api";
import { AddTeamMemberModal } from "@/components/addTeamMemberModal";

const ROLE_COLORS: Record<string, string> = {
  admin:      "bg-purple-100 text-purple-700",
  engineer:   "bg-blue-100 text-blue-700",
  supervisor: "bg-orange-100 text-orange-700",
  accountant: "bg-green-100 text-green-700",
  viewer:     "bg-slate-100 text-slate-600",
};

export default function TeamPage() {
  const [team, setTeam]         = useState<Worker[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading]   = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch]     = useState("");
  const [showModal, setShowModal] = useState(false);

  const loadTeam = useCallback(async () => {
    try {
      const r = await api.workers.list({ workerType: "employee" });
      console.log("📋 Team list loaded:", r.data.length, "members");
      setTeam(r.data);
    } catch (e) {
      console.error("❌ Error loading team:", e);
    }
  }, []);

  const loadProjects = useCallback(async () => {
    try {
      const res = await api.projects.list();
      setProjects(res.data);
    } catch (e) {
      console.error("❌ Error loading projects:", e);
    }
  }, []);

  useEffect(() => {
    Promise.all([loadTeam(), loadProjects()])
      .finally(() => setLoading(false));
  }, [loadTeam, loadProjects]);

  // Refresh team list every 5 seconds to catch staff added from other pages
  useEffect(() => {
    const interval = setInterval(() => {
      loadTeam();
    }, 5000);
    return () => clearInterval(interval);
  }, [loadTeam]);

  const filtered = team.filter(m =>
    m.name.toLowerCase().includes(search.toLowerCase()) ||
    (m.email || "").toLowerCase().includes(search.toLowerCase()) ||
    (m.role || "").toLowerCase().includes(search.toLowerCase())
  );

  const handleRemove = async (id: string, name: string) => {
    if (!confirm(`Delete ${name}? They will no longer have access.`)) return;
    try {
      await api.workers.delete(id);
      setTeam(prev => prev.filter(m => m._id !== id));
    } catch (err) { console.error(err); }
  };

  if (loading) return (
    <div className="p-6 flex items-center justify-center min-h-64">
      <Loader2 className="w-6 h-6 animate-spin text-orange-500" />
    </div>
  );

  return (
    <div className="p-4 lg:p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Team Members</h1>
          <p className="text-slate-500 text-sm">{team.length} member{team.length !== 1 ? "s" : ""} in your company</p>
        </div>
        <div className="flex gap-2">
          <button onClick={async () => { setRefreshing(true); await loadTeam(); setRefreshing(false); }}
            disabled={refreshing}
            className="flex items-center gap-2 px-3 py-2.5 border border-slate-200 rounded-xl text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50">
            <RefreshCw className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`} /> Refresh
          </button>
          <button onClick={() => setShowModal(true)}
            className="flex items-center gap-2 px-4 py-2.5 bg-orange-500 hover:bg-orange-600 text-white rounded-xl text-sm font-semibold">
            <UserPlus className="w-4 h-4" /> Add Member
          </button>
        </div>
      </div>

      {/* Role breakdown */}
      <div className="flex flex-wrap gap-2 mb-5">
        {Object.entries(
          team.reduce((acc, m) => ({ ...acc, [m.role]: (acc[m.role] || 0) + 1 }), {} as Record<string, number>)
        ).map(([role, count]) => (
          <div key={role} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold capitalize ${ROLE_COLORS[role] || "bg-slate-100 text-slate-600"}`}>
            <Shield className="w-3 h-3" />{role} ({count})
          </div>
        ))}
      </div>

      {/* Search */}
      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <input placeholder="Search by name, email, or role..." value={search} onChange={e => setSearch(e.target.value)}
          className="w-full pl-9 pr-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-500" />
      </div>

      {filtered.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-12 text-center">
          <Users className="w-10 h-10 text-slate-300 mx-auto mb-3" />
          <p className="text-slate-500 font-medium">{team.length === 0 ? "No team members yet" : "No results found"}</p>
          {team.length === 0 && (
            <button onClick={() => setShowModal(true)} className="mt-4 px-4 py-2 bg-orange-500 text-white rounded-xl text-sm font-semibold hover:bg-orange-600">Add First Member</button>
          )}
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100">
                {["Name", "Email", "Role", "Sites", "Joined", "Status", ""].map(h => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filtered.map(m => (
                <tr key={m._id} className="hover:bg-slate-50">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-orange-100 rounded-full flex items-center justify-center text-orange-600 font-bold text-sm">
                        {m.name.charAt(0).toUpperCase()}
                      </div>
                      <span className="font-semibold text-slate-900 text-sm">{m.name}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm text-slate-600">{m.email}</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2.5 py-1 rounded-full font-medium capitalize ${ROLE_COLORS[m.role] || "bg-slate-100 text-slate-600"}`}>{m.role}</span>
                  </td>
                  <td className="px-4 py-3 text-sm text-slate-600">
                    {m.assignedSite?.name || "All Sites"}
                  </td>

                  <td className="px-4 py-3 text-sm text-slate-500">
                    {m.createdAt ? new Date(m.createdAt).toLocaleDateString("en-IN") : "-"}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${m.isActive ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>
                      {m.isActive ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {m.role !== "admin" && (
                      <button onClick={() => handleRemove(m._id, m.name)} className="flex items-center gap-1 text-xs text-red-500 hover:text-red-700 font-medium">
                        <Trash2 className="w-3 h-3" /> Delete
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showModal && (
        <AddTeamMemberModal
          projects={projects}
          onClose={() => setShowModal(false)}
          onSaved={() => loadTeam()}
        />
      )}
    </div>
  );
}
