"use client";

import { useState, useEffect, useCallback } from "react";
import { UserPlus, Search, Loader2, Users, RefreshCw, Trash2, Edit2, Phone, Mail, Briefcase, Calendar, DollarSign } from "lucide-react";
import { api, type Worker } from "@/lib/api";
import { AddStaffMemberModal } from "@/components/addStaffMemberModal";

const ROLE_COLORS: Record<string, string> = {
  admin:      "bg-purple-100 text-purple-700",
  engineer:   "bg-blue-100 text-blue-700",
  supervisor: "bg-orange-100 text-orange-700",
  accountant: "bg-green-100 text-green-700",
  "office-staff": "bg-indigo-100 text-indigo-700",
  viewer:     "bg-slate-100 text-slate-600",
};

export default function StaffDetailsPage() {
  const [staff, setStaff] = useState<Worker[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [selectedStaff, setSelectedStaff] = useState<Worker | null>(null);

  const loadStaff = useCallback(async () => {
    try {
      const r = await api.workers.list({ workerType: "employee", limit: "200" });
      console.log("👥 Staff list loaded:", r.data.length, "staff members");
      setStaff(r.data);
    } catch (e) {
      console.error("❌ Error loading staff:", e);
    }
  }, []);

  useEffect(() => {
    loadStaff().finally(() => setLoading(false));
  }, [loadStaff]);

  // Auto-refresh every 5 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      loadStaff();
    }, 5000);
    return () => clearInterval(interval);
  }, [loadStaff]);

  const filtered = staff.filter(m =>
    m.name.toLowerCase().includes(search.toLowerCase()) ||
    m.phone?.toLowerCase().includes(search.toLowerCase()) ||
    m.role.toLowerCase().includes(search.toLowerCase())
  );

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Delete ${name}? This action cannot be undone.`)) return;
    try {
      await api.workers.delete(id);
      setStaff(prev => prev.filter(w => w._id !== id));
    } catch (err) { 
      console.error(err); 
      alert("Failed to delete staff member");
    }
  };

  const handleEdit = (staff: Worker) => {
    setSelectedStaff(staff);
    setShowModal(true);
  };

  if (loading) return (
    <div className="p-6 flex items-center justify-center min-h-64">
      <Loader2 className="w-6 h-6 animate-spin text-orange-500" />
    </div>
  );

  return (
    <div className="p-4 lg:p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Staff Details</h1>
          <p className="text-slate-500 text-sm">Manage all employees and staff members · {staff.length} total</p>
        </div>
        <div className="flex gap-2">
          <button 
            onClick={async () => { setRefreshing(true); await loadStaff(); setRefreshing(false); }}
            disabled={refreshing}
            className="flex items-center gap-2 px-3 py-2.5 border border-slate-200 rounded-xl text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50">
            <RefreshCw className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`} /> Refresh
          </button>
          <button 
            onClick={() => { setSelectedStaff(null); setShowModal(true); }}
            className="flex items-center gap-2 px-4 py-2.5 bg-orange-500 hover:bg-orange-600 text-white rounded-xl text-sm font-semibold">
            <UserPlus className="w-4 h-4" /> Add Staff
          </button>
        </div>
      </div>

      {/* Role breakdown */}
      <div className="flex flex-wrap gap-2">
        {Object.entries(
          staff.reduce((acc, m) => ({ ...acc, [m.role]: (acc[m.role] || 0) + 1 }), {} as Record<string, number>)
        ).map(([role, count]) => (
          <div key={role} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold capitalize ${ROLE_COLORS[role] || "bg-slate-100 text-slate-600"}`}>
            <Briefcase className="w-3 h-3" /> {role} ({count})
          </div>
        ))}
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <input 
          placeholder="Search by name, phone, or role..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full pl-9 pr-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-500" />
      </div>

      {/* Staff List */}
      {filtered.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-12 text-center">
          <Users className="w-10 h-10 text-slate-300 mx-auto mb-3" />
          <p className="text-slate-500 font-medium">{staff.length === 0 ? "No staff yet" : "No results found"}</p>
          {staff.length === 0 && (
            <button 
              onClick={() => { setSelectedStaff(null); setShowModal(true); }}
              className="mt-4 px-4 py-2 bg-orange-500 text-white rounded-xl text-sm font-semibold hover:bg-orange-600">
              Add First Staff Member
            </button>
          )}
        </div>
      ) : (
        <div className="grid gap-4">
          {filtered.map(member => (
            <div key={member._id} className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 hover:shadow-md transition">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-10 h-10 bg-orange-100 rounded-full flex items-center justify-center text-orange-600 font-bold text-sm">
                      {member.name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <h3 className="font-semibold text-slate-900">{member.name}</h3>
                      <p className="text-xs text-slate-500">ID: {member._id.slice(-8)}</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4">
                    {member.phone && (
                      <div className="flex items-center gap-2 text-sm">
                        <Phone className="w-4 h-4 text-slate-400" />
                        <span className="text-slate-600">{member.phone}</span>
                      </div>
                    )}
                    <div className="flex items-center gap-2 text-sm">
                      <Briefcase className="w-4 h-4 text-slate-400" />
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium capitalize ${ROLE_COLORS[member.role] || "bg-slate-100 text-slate-600"}`}>
                        {member.role}
                      </span>
                    </div>
                    {member.monthlySalary ? (
                      <div className="flex items-center gap-2 text-sm">
                        <DollarSign className="w-4 h-4 text-slate-400" />
                        <span className="text-slate-600">₹{member.monthlySalary.toLocaleString("en-IN")}</span>
                      </div>
                    ) : null}
                    <div className="flex items-center gap-2 text-sm">
                      <Calendar className="w-4 h-4 text-slate-400" />
                      <span className="text-slate-600">{new Date(member.createdAt || new Date()).toLocaleDateString("en-IN")}</span>
                    </div>
                  </div>
                </div>

                <div className="flex gap-2">
                  <button 
                    onClick={() => handleEdit(member)}
                    className="flex items-center gap-1 px-3 py-1.5 text-blue-600 hover:bg-blue-50 rounded-lg text-xs font-medium border border-blue-200">
                    <Edit2 className="w-3 h-3" /> Edit
                  </button>
                  <button 
                    onClick={() => handleDelete(member._id, member.name)}
                    className="flex items-center gap-1 px-3 py-1.5 text-red-600 hover:bg-red-50 rounded-lg text-xs font-medium border border-red-200">
                    <Trash2 className="w-3 h-3" /> Delete
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add/Edit Modal */}
      {showModal && (
        <AddStaffMemberModal
          editingStaff={selectedStaff || undefined}
          onClose={() => { setShowModal(false); setSelectedStaff(null); }}
          onSaved={() => loadStaff()}
        />
      )}
    </div>
  );
}
