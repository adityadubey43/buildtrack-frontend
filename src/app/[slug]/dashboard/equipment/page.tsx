"use client";

import { useState, useEffect } from "react";
import { Wrench, Plus, AlertTriangle, Loader2 } from "lucide-react";
import { api, type Equipment } from "@/lib/api";

const STATUS_MAP: Record<string, string> = {
  active:      "bg-green-100 text-green-700",
  maintenance: "bg-red-100 text-red-700",
  idle:        "bg-slate-100 text-slate-600",
  retired:     "bg-slate-100 text-slate-400",
};

export default function EquipmentPage() {
  const [equipment, setEquipment] = useState<Equipment[]>([]);
  const [loading, setLoading]     = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving]       = useState(false);
  const [form, setForm] = useState({ name: "", type: "", ownershipType: "owned" });

  useEffect(() => {
    api.equipment.list()
      .then((r) => setEquipment(r.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const dueMaintenance = equipment.filter(e => {
    if (!e.nextMaintenanceDate) return false;
    return new Date(e.nextMaintenanceDate) <= new Date(Date.now() + 3 * 86400000);
  });

  const handleAdd = async () => {
    if (!form.name || !form.type) return;
    setSaving(true);
    try {
      const res = await api.equipment.create({ name: form.name, type: form.type, ownershipType: form.ownershipType, status: "idle" });
      setEquipment(prev => [res.data, ...prev]);
      setShowModal(false);
      setForm({ name: "", type: "", ownershipType: "owned" });
    } catch (err) { console.error(err); }
    finally { setSaving(false); }
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
          <h1 className="text-2xl font-bold text-slate-900">Equipment Management</h1>
          <p className="text-slate-500 text-sm">Track machinery across all sites</p>
        </div>
        <button onClick={() => setShowModal(true)}
          className="flex items-center gap-2 px-4 py-2.5 bg-orange-500 hover:bg-orange-600 text-white rounded-xl text-sm font-semibold">
          <Plus className="w-4 h-4" /> Add Equipment
        </button>
      </div>

      {dueMaintenance.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-3 mb-5 flex items-center gap-2 text-sm text-red-700">
          <AlertTriangle className="w-4 h-4 flex-shrink-0" />
          {dueMaintenance.length} item{dueMaintenance.length > 1 ? "s" : ""} due for maintenance: {dueMaintenance.map(e => e.name).join(", ")}
        </div>
      )}

      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-green-50 border border-green-100 rounded-2xl p-4 text-center">
          <div className="text-2xl font-black text-green-700">{equipment.filter(e => e.status === "active").length}</div>
          <div className="text-xs text-green-600 font-medium">Active</div>
        </div>
        <div className="bg-slate-100 border border-slate-200 rounded-2xl p-4 text-center">
          <div className="text-2xl font-black text-slate-600">{equipment.filter(e => e.status === "idle").length}</div>
          <div className="text-xs text-slate-500 font-medium">Idle</div>
        </div>
        <div className="bg-red-50 border border-red-100 rounded-2xl p-4 text-center">
          <div className="text-2xl font-black text-red-600">{equipment.filter(e => e.status === "maintenance").length}</div>
          <div className="text-xs text-red-500 font-medium">In Maintenance</div>
        </div>
      </div>

      {equipment.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-12 text-center">
          <Wrench className="w-10 h-10 text-slate-300 mx-auto mb-3" />
          <p className="text-slate-500 font-medium">No equipment added yet</p>
          <p className="text-slate-400 text-sm mt-1">Add your machinery to track usage across sites.</p>
          <button onClick={() => setShowModal(true)} className="mt-4 px-4 py-2 bg-orange-500 text-white rounded-xl text-sm font-semibold hover:bg-orange-600">Add Equipment</button>
        </div>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {equipment.map((eq) => (
            <div key={eq._id} className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
              <div className="flex items-start justify-between mb-3">
                <div className="w-10 h-10 bg-orange-50 rounded-xl flex items-center justify-center">
                  <Wrench className="w-5 h-5 text-orange-500" />
                </div>
                <span className={`text-xs px-2.5 py-1 rounded-full font-medium capitalize ${STATUS_MAP[eq.status] || STATUS_MAP.idle}`}>{eq.status}</span>
              </div>
              <h3 className="font-bold text-slate-900 mb-0.5">{eq.name}</h3>
              <p className="text-sm text-slate-500 mb-3">{eq.type} · <span className="capitalize">{eq.ownershipType}</span></p>
              <div className="flex items-center justify-between text-xs text-slate-500 border-t border-slate-50 pt-3">
                <span>{eq.assignedProject?.name || "No site assigned"}</span>
                <span className="font-semibold text-slate-700">{eq.totalHoursUsed}h used</span>
              </div>
              {eq.nextMaintenanceDate && (
                <p className={`text-xs mt-2 font-medium ${new Date(eq.nextMaintenanceDate) <= new Date() ? "text-red-600" : "text-slate-400"}`}>
                  Maint: {new Date(eq.nextMaintenanceDate).toLocaleDateString("en-IN")}
                </p>
              )}
            </div>
          ))}
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
            <div className="flex items-center justify-between p-5 border-b border-slate-100">
              <h2 className="font-bold text-slate-900">Add Equipment</h2>
              <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-slate-600">✕</button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Equipment Name</label>
                <input placeholder="e.g. JCB Excavator" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })}
                  className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Type / Category</label>
                <input placeholder="e.g. Heavy Machinery" value={form.type} onChange={e => setForm({ ...form, type: e.target.value })}
                  className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Ownership</label>
                <select value={form.ownershipType} onChange={e => setForm({ ...form, ownershipType: e.target.value })}
                  className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-500">
                  <option value="owned">Owned</option>
                  <option value="rented">Rented</option>
                  <option value="leased">Leased</option>
                </select>
              </div>
            </div>
            <div className="flex gap-3 p-5 border-t border-slate-100">
              <button onClick={() => setShowModal(false)} className="flex-1 py-2.5 border border-slate-200 rounded-xl text-slate-600 text-sm font-medium">Cancel</button>
              <button onClick={handleAdd} disabled={saving || !form.name || !form.type}
                className="flex-1 py-2.5 bg-orange-500 hover:bg-orange-600 text-white rounded-xl text-sm font-semibold disabled:opacity-60">
                {saving ? "Adding..." : "Add Equipment"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
