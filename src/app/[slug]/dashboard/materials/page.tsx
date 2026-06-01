"use client";

import { useState, useEffect } from "react";
import { Package, AlertTriangle, Plus, Search, Loader2 } from "lucide-react";
import { api, type Material, type Project } from "@/lib/api";

const STOCK_STATUS = (m: Material) => {
  if (m.currentStock <= 0) return { label: "Out of Stock", color: "bg-red-100 text-red-700" };
  if (m.currentStock < m.minimumStock) return { label: "Low Stock",  color: "bg-yellow-100 text-yellow-700" };
  return { label: "In Stock", color: "bg-green-100 text-green-700" };
};

export default function MaterialsPage() {
  const [materials, setMaterials] = useState<Material[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading]     = useState(true);
  const [search, setSearch]       = useState("");
  const [projectFilter, setProjectFilter] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving]       = useState(false);
  const [form, setForm] = useState({ name: "", category: "", unit: "", currentStock: "", minimumStock: "", project: "" });
  const [stockAction, setStockAction] = useState<{
    type: "usage" | "purchase";
    material: Material | null;
    quantity: string;
  } | null>(null);

  useEffect(() => {
    api.projects.list({ status: "active", limit: "100" } as Record<string, string>)
      .then((r) => setProjects(r.data))
      .catch(console.error);
  }, []);

  useEffect(() => {
    setLoading(true);
    api.materials.list(projectFilter ? { project: projectFilter } : undefined)
      .then((r) => setMaterials(r.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [projectFilter]);

  const filtered = materials.filter(m =>
    m.name.toLowerCase().includes(search.toLowerCase()) ||
    (m.project?.name || "").toLowerCase().includes(search.toLowerCase())
  );

  const lowStock = materials.filter(m => m.currentStock < m.minimumStock);

  const handleAdd = async () => {
    if (!form.name || !form.unit) return;
    setSaving(true);
    try {
      const payload = {
        name: form.name,
        category: form.category,
        unit: form.unit,
        currentStock: parseFloat(form.currentStock) || 0,
        minimumStock: parseFloat(form.minimumStock) || 0,
        lastPurchasePrice: 0,
        onOrder: 0,
        project: form.project || undefined,
      } as unknown as Partial<Material>;

      const res = await api.materials.create(payload);
      setMaterials(prev => [res.data, ...prev]);
      setShowModal(false);
      setForm({ name: "", category: "", unit: "", currentStock: "", minimumStock: "", project: "" });
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
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Materials</h1>
          <p className="text-slate-500 text-sm">Track inventory across all sites</p>
        </div>
        <button onClick={() => setShowModal(true)}
          className="flex items-center gap-2 px-4 py-2.5 bg-orange-500 hover:bg-orange-600 text-white rounded-xl text-sm font-semibold">
          <Plus className="w-4 h-4" /> Add Material
        </button>
      </div>

      <div className="grid gap-3 md:grid-cols-[1fr_auto] mb-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input placeholder="Search materials..." value={search} onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-500" />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Filter by project</label>
          <select value={projectFilter} onChange={(e) => setProjectFilter(e.target.value)}
            className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500">
            <option value="">All projects</option>
            {projects.map((project) => (
              <option key={project._id} value={project._id}>{project.name}</option>
            ))}
          </select>
        </div>
      </div>

      {lowStock.length > 0 && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-3 mb-5 flex items-start gap-2 text-sm text-yellow-800">
          <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
          <span><strong>{lowStock.length} item{lowStock.length > 1 ? "s" : ""} low on stock:</strong> {lowStock.map(m => m.name).join(", ")}</span>
        </div>
      )}

      {/* Summary */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-white border border-slate-100 rounded-2xl p-4 shadow-sm text-center">
          <div className="text-2xl font-black text-slate-900">{materials.length}</div>
          <div className="text-xs text-slate-500 font-medium">Total Items</div>
        </div>
        <div className="bg-yellow-50 border border-yellow-100 rounded-2xl p-4 text-center">
          <div className="text-2xl font-black text-yellow-700">{lowStock.length}</div>
          <div className="text-xs text-yellow-600 font-medium">Low Stock</div>
        </div>
        <div className="bg-orange-50 border border-orange-100 rounded-2xl p-4 text-center">
          <div className="text-2xl font-black text-orange-700">{materials.reduce((sum, m) => sum + (m.totalUsed || 0), 0)}</div>
          <div className="text-xs text-orange-600 font-medium">Total Used</div>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-12 text-center">
          <Package className="w-10 h-10 text-slate-300 mx-auto mb-3" />
          <p className="text-slate-500 font-medium">{materials.length === 0 ? "No materials added yet" : "No results found"}</p>
          {materials.length === 0 && (
            <button onClick={() => setShowModal(true)} className="mt-4 px-4 py-2 bg-orange-500 text-white rounded-xl text-sm font-semibold hover:bg-orange-600">Add Material</button>
          )}
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100">
                  {["Material", "Category", "Project", "Unit", "Stock", "Min Stock", "Total Used", "Status", "Actions"].map(h => (
                    <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {filtered.map(m => {
                  const st = STOCK_STATUS(m);
                  return (
                    <tr key={m._id} className="hover:bg-slate-50">
                      <td className="px-4 py-3 font-semibold text-slate-900 text-sm">{m.name}</td>
                      <td className="px-4 py-3 text-sm text-slate-600 capitalize">{m.category || "—"}</td>
                      <td className="px-4 py-3 text-sm text-slate-600">{m.project?.name || "—"}</td>
                      <td className="px-4 py-3 text-sm text-slate-600">{m.unit}</td>
                      <td className="px-4 py-3 font-bold text-slate-900 text-sm">{m.currentStock}</td>
                      <td className="px-4 py-3 text-sm text-slate-500">{m.minimumStock}</td>
                      <td className="px-4 py-3 text-sm text-slate-500">{m.totalUsed > 0 ? m.totalUsed : "—"}</td>
                      <td className="px-4 py-3">
                        <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${st.color}`}>{st.label}</span>
                      </td>
                      <td className="px-4 py-3 flex flex-wrap gap-2">
                        <button
                          onClick={() => setStockAction({ type: "usage", material: m, quantity: "" })}
                          disabled={m.currentStock <= 0}
                          className="rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100 disabled:opacity-50"
                        >
                          Use stock
                        </button>
                        <button
                          onClick={() => setStockAction({ type: "purchase", material: m, quantity: "" })}
                          className="rounded-xl border border-orange-200 bg-orange-50 px-3 py-1.5 text-xs font-medium text-orange-700 hover:bg-orange-100"
                        >
                          {m.currentStock <= 0 ? "Refill stock" : "Add stock"}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {stockAction && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
            <div className="flex items-center justify-between p-5 border-b border-slate-100">
              <h2 className="font-bold text-slate-900">{stockAction.type === "usage" ? "Use Stock" : "Refill Stock"}</h2>
              <button onClick={() => setStockAction(null)} className="text-slate-400 hover:text-slate-600">✕</button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Material</label>
                <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-800">
                  {stockAction.material?.name}
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Quantity {stockAction.type === "usage" ? "used" : "to add"}</label>
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={stockAction.quantity}
                  onChange={(e) => setStockAction({ ...stockAction, quantity: e.target.value })}
                  className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
                  placeholder="Enter quantity"
                />
              </div>
              {stockAction.type === "usage" && stockAction.material?.currentStock !== undefined && (
                <p className="text-sm text-slate-500">Current stock: <span className="font-semibold text-slate-900">{stockAction.material.currentStock}</span></p>
              )}
            </div>
            <div className="flex gap-3 p-5 border-t border-slate-100">
              <button onClick={() => setStockAction(null)} className="flex-1 py-2.5 border border-slate-200 rounded-xl text-slate-600 text-sm font-medium">Cancel</button>
              <button onClick={async () => {
                if (!stockAction?.material) return;
                const quantity = parseFloat(stockAction.quantity);
                if (!quantity || quantity <= 0) {
                  alert("Enter a valid quantity.");
                  return;
                }
                if (stockAction.type === "usage" && quantity > (stockAction.material.currentStock || 0)) {
                  alert("Quantity used cannot exceed available stock.");
                  return;
                }
                setSaving(true);
                try {
                  const response = await api.materials.addTransaction(stockAction.material._id, {
                    type: stockAction.type,
                    quantity,
                    project: stockAction.material.project?._id,
                  });
                  setMaterials(prev => prev.map(item => {
                    if (item._id !== stockAction.material?._id) return item;
                    return {
                      ...item,
                      currentStock: stockAction.type === "usage" ? item.currentStock - quantity : item.currentStock + quantity,
                      totalUsed: stockAction.type === "usage" ? (item.totalUsed || 0) + quantity : item.totalUsed,
                    };
                  }));
                  setStockAction(null);
                } catch (err: any) {
                  console.error(err);
                  const errorMsg = err?.message || "Unable to update stock. Please try again.";
                  alert(errorMsg);
                } finally {
                  setSaving(false);
                }
              }}
                className="flex-1 py-2.5 bg-orange-500 hover:bg-orange-600 text-white rounded-xl text-sm font-semibold disabled:opacity-60">
                {saving ? "Saving..." : stockAction.type === "usage" ? "Use Stock" : "Refill Stock"}
              </button>
            </div>
          </div>
        </div>
      )}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
            <div className="flex items-center justify-between p-5 border-b border-slate-100">
              <h2 className="font-bold text-slate-900">Add Material</h2>
              <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-slate-600">✕</button>
            </div>
            <div className="p-5 space-y-4">
              {[
                { key: "name",         label: "Material Name",        placeholder: "e.g. Cement OPC 53" },
                { key: "category",     label: "Category",             placeholder: "e.g. Binding, Steel, Sand" },
                { key: "unit",         label: "Unit",                 placeholder: "e.g. Bags, MT, Brass" },
                { key: "currentStock", label: "Initial Stock Quantity", placeholder: "e.g. 100" },
                { key: "minimumStock", label: "Minimum Stock",        placeholder: "Alert below this quantity" },
              ].map(f => (
                <div key={f.key}>
                  <label className="block text-sm font-medium text-slate-700 mb-1">{f.label}</label>
                  <input placeholder={f.placeholder} value={form[f.key as keyof typeof form]}
                    onChange={e => setForm({ ...form, [f.key]: e.target.value })}
                    className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-500" />
                </div>
              ))}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Project</label>
                <select
                  value={form.project}
                  onChange={(e) => setForm({ ...form, project: e.target.value })}
                  className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
                >
                  <option value="">Assign to project (optional)</option>
                  {projects.map((project) => (
                    <option key={project._id} value={project._id}>{project.name}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="flex gap-3 p-5 border-t border-slate-100">
              <button onClick={() => setShowModal(false)} className="flex-1 py-2.5 border border-slate-200 rounded-xl text-slate-600 text-sm font-medium">Cancel</button>
              <button onClick={handleAdd} disabled={saving || !form.name || !form.unit}
                className="flex-1 py-2.5 bg-orange-500 hover:bg-orange-600 text-white rounded-xl text-sm font-semibold disabled:opacity-60">
                {saving ? "Adding..." : "Add Material"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
