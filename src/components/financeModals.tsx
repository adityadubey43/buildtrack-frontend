"use client";

import { useState, useEffect } from "react";
import { X, Plus } from "lucide-react";
import { api, type Project, type Expense, type PaymentReceived, type Vendor } from "@/lib/api";

// ── Shared vendor selector ─────────────────────────────────────────────────────
function VendorSelector({
  value,
  onChange,
  accentRing = "focus:ring-orange-400",
}: {
  value: string;         // vendorId
  onChange: (vendorId: string, vendorName: string) => void;
  accentRing?: string;
}) {
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [err, setErr] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.vendors.list().then((r) => setVendors(r.data)).catch(() => {});
  }, []);

  const handleCreate = async () => {
    if (!newName.trim()) { setErr("Name is required."); return; }
    setSaving(true); setErr("");
    try {
      const res = await api.vendors.create({ name: newName.trim(), phone: newPhone.trim() });
      const v = res.data;
      setVendors((prev) => [...prev, v].sort((a, b) => a.name.localeCompare(b.name)));
      onChange(v._id, v.name);
      setCreating(false); setNewName(""); setNewPhone("");
    } catch (e: unknown) {
      // If vendor already exists (409), backend returns the existing doc
      const msg = e instanceof Error ? e.message : "Failed to create vendor.";
      setErr(msg);
    } finally { setSaving(false); }
  };

  if (creating) {
    return (
      <div className="border border-slate-200 rounded-lg p-3 space-y-2">
        <p className="text-xs font-medium text-slate-600">New Vendor</p>
        {err && <p className="text-xs text-red-500">{err}</p>}
        <input
          type="text" placeholder="Vendor name *" value={newName}
          onChange={(e) => setNewName(e.target.value)}
          className={`w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 ${accentRing}`}
        />
        <input
          type="text" placeholder="Phone (optional)" value={newPhone}
          onChange={(e) => setNewPhone(e.target.value)}
          className={`w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 ${accentRing}`}
        />
        <div className="flex gap-2">
          <button type="button" onClick={() => { setCreating(false); setErr(""); }}
            className="flex-1 px-3 py-1.5 border border-slate-200 rounded-lg text-xs text-slate-600 hover:bg-slate-50">Cancel</button>
          <button type="button" onClick={handleCreate} disabled={saving}
            className="flex-1 px-3 py-1.5 bg-orange-500 text-white rounded-lg text-xs font-medium disabled:opacity-50">
            {saving ? "Saving..." : "Create & Select"}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex gap-2">
      <select
        value={value}
        onChange={(e) => {
          const v = vendors.find((v) => v._id === e.target.value);
          onChange(e.target.value, v?.name ?? "");
        }}
        className={`flex-1 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 ${accentRing}`}
      >
        <option value="">— No vendor —</option>
        {vendors.map((v) => <option key={v._id} value={v._id}>{v.name}{v.phone ? ` · ${v.phone}` : ""}</option>)}
      </select>
      <button type="button" onClick={() => setCreating(true)}
        className="px-2.5 py-2 border border-slate-200 rounded-lg text-slate-500 hover:bg-slate-50 hover:text-orange-500 transition-colors"
        title="Create new vendor">
        <Plus className="w-4 h-4" />
      </button>
    </div>
  );
}

// ── Add Expense Modal ──────────────────────────────────────────────────────────
export function AddExpenseModal({
  projects,
  onClose,
  onSaved,
}: {
  projects: Project[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState({
    project: "", type: "labour", description: "",
    amount: "", paidAmount: "",
    date: new Date().toISOString().split("T")[0],
    vendorId: "", vendor: "", paymentMode: "cash", notes: "",
  });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.project || !form.description || !form.amount) {
      setErr("Project, description, and amount are required.");
      return;
    }
    setSaving(true); setErr("");
    try {
      await api.expenses.create({
        ...form,
        amount: Number(form.amount),
        paidAmount: Number(form.paidAmount) || 0,
        vendorId: form.vendorId || null,
      });
      onSaved(); onClose();
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Failed to save.");
    } finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-5 border-b border-slate-100">
          <h2 className="font-bold text-slate-900 text-lg">Add Expense</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X className="w-5 h-5" /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {err && <p className="text-red-600 text-sm bg-red-50 rounded-lg p-3">{err}</p>}

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Project *</label>
            <select value={form.project} onChange={(e) => set("project", e.target.value)}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400" required>
              <option value="">Select project...</option>
              {projects.map((p) => <option key={p._id} value={p._id}>{p.name}</option>)}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Type *</label>
              <select value={form.type} onChange={(e) => set("type", e.target.value)}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400">
                <option value="labour">Labour</option>
                <option value="material">Material</option>
                <option value="miscellaneous">Miscellaneous</option>
                <option value="travel">Travel</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Payment Mode</label>
              <select value={form.paymentMode} onChange={(e) => set("paymentMode", e.target.value)}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400">
                <option value="cash">Cash</option>
                <option value="bank">Bank Transfer</option>
                <option value="upi">UPI</option>
                <option value="cheque">Cheque</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Description *</label>
            <input type="text" value={form.description} onChange={(e) => set("description", e.target.value)}
              placeholder="e.g. Cement purchase, Labour wages..."
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400" required />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Bill Amount (₹) *</label>
              <input type="number" min="0" step="0.01" value={form.amount} onChange={(e) => set("amount", e.target.value)}
                placeholder="0"
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400" required />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Paid Amount (₹)</label>
              <input type="number" min="0" step="0.01" value={form.paidAmount} onChange={(e) => set("paidAmount", e.target.value)}
                placeholder="0"
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400" />
            </div>
          </div>

          {form.amount && (
            <div className={`rounded-lg px-3 py-2 text-xs font-medium ${
              Number(form.paidAmount) >= Number(form.amount)
                ? "bg-green-50 text-green-700"
                : Number(form.paidAmount) > 0
                ? "bg-yellow-50 text-yellow-700"
                : "bg-red-50 text-red-600"
            }`}>
              Outstanding: ₹{(Number(form.amount) - Number(form.paidAmount || 0)).toLocaleString("en-IN")}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Date *</label>
            <input type="date" value={form.date} onChange={(e) => set("date", e.target.value)}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400" required />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Vendor (optional)</label>
            <VendorSelector
              value={form.vendorId}
              onChange={(id, name) => setForm((f) => ({ ...f, vendorId: id, vendor: name }))}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Notes (optional)</label>
            <textarea value={form.notes} onChange={(e) => set("notes", e.target.value)} rows={2}
              placeholder="Additional notes..."
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 resize-none" />
          </div>

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 px-4 py-2.5 border border-slate-200 rounded-xl text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors">Cancel</button>
            <button type="submit" disabled={saving} className="flex-1 px-4 py-2.5 bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white rounded-xl text-sm font-semibold transition-colors">
              {saving ? "Saving..." : "Add Expense"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Edit Expense Modal ─────────────────────────────────────────────────────────
export function EditExpenseModal({
  expense,
  projects,
  onClose,
  onSaved,
}: {
  expense: Expense;
  projects: Project[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const projectId = typeof expense.project === "object" ? expense.project._id : expense.project as string;
  const existingVendorId = expense.vendorId && typeof expense.vendorId === "object" ? expense.vendorId._id : "";
  const [form, setForm] = useState({
    project: projectId,
    type: expense.type,
    description: expense.description,
    amount: String(expense.amount),
    paidAmount: String(expense.paidAmount ?? 0),
    date: expense.date.split("T")[0],
    vendorId: existingVendorId,
    vendor: expense.vendor ?? "",
    paymentMode: expense.paymentMode,
    notes: expense.notes ?? "",
  });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.project || !form.description || !form.amount) {
      setErr("Project, description, and amount are required.");
      return;
    }
    setSaving(true); setErr("");
    try {
      await api.expenses.update(expense._id, {
        ...form,
        amount: Number(form.amount),
        paidAmount: Number(form.paidAmount) || 0,
        vendorId: form.vendorId || null,
      });
      onSaved(); onClose();
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Failed to save.");
    } finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-5 border-b border-slate-100">
          <h2 className="font-bold text-slate-900 text-lg">Edit Expense</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X className="w-5 h-5" /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {err && <p className="text-red-600 text-sm bg-red-50 rounded-lg p-3">{err}</p>}

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Project *</label>
            <select value={form.project} onChange={(e) => set("project", e.target.value)}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400" required>
              <option value="">Select project...</option>
              {projects.map((p) => <option key={p._id} value={p._id}>{p.name}</option>)}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Type *</label>
              <select value={form.type} onChange={(e) => set("type", e.target.value)}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400">
                <option value="labour">Labour</option>
                <option value="material">Material</option>
                <option value="miscellaneous">Miscellaneous</option>
                <option value="travel">Travel</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Payment Mode</label>
              <select value={form.paymentMode} onChange={(e) => set("paymentMode", e.target.value)}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400">
                <option value="cash">Cash</option>
                <option value="bank">Bank Transfer</option>
                <option value="upi">UPI</option>
                <option value="cheque">Cheque</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Description *</label>
            <input type="text" value={form.description} onChange={(e) => set("description", e.target.value)}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400" required />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Bill Amount (₹) *</label>
              <input type="number" min="0" step="0.01" value={form.amount} onChange={(e) => set("amount", e.target.value)}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400" required />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Paid Amount (₹)</label>
              <input type="number" min="0" step="0.01" value={form.paidAmount} onChange={(e) => set("paidAmount", e.target.value)}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400" />
            </div>
          </div>

          {form.amount && (
            <div className={`rounded-lg px-3 py-2 text-xs font-medium ${
              Number(form.paidAmount) >= Number(form.amount) ? "bg-green-50 text-green-700"
              : Number(form.paidAmount) > 0 ? "bg-yellow-50 text-yellow-700"
              : "bg-red-50 text-red-600"
            }`}>
              Outstanding: ₹{(Number(form.amount) - Number(form.paidAmount || 0)).toLocaleString("en-IN")}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Date *</label>
            <input type="date" value={form.date} onChange={(e) => set("date", e.target.value)}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400" required />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Vendor (optional)</label>
            <VendorSelector
              value={form.vendorId}
              onChange={(id, name) => setForm((f) => ({ ...f, vendorId: id, vendor: name }))}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Notes (optional)</label>
            <textarea value={form.notes} onChange={(e) => set("notes", e.target.value)} rows={2}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 resize-none" />
          </div>

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 px-4 py-2.5 border border-slate-200 rounded-xl text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors">Cancel</button>
            <button type="submit" disabled={saving} className="flex-1 px-4 py-2.5 bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white rounded-xl text-sm font-semibold transition-colors">
              {saving ? "Saving..." : "Save Changes"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Add Payment Modal ──────────────────────────────────────────────────────────
export function AddPaymentModal({
  projects,
  onClose,
  onSaved,
}: {
  projects: Project[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState({
    project: "",
    clientName: "",
    amount: "",
    date: new Date().toISOString().split("T")[0],
    paymentMode: "bank",
    milestone: "",
    reference: "",
    notes: "",
  });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.project || !form.clientName || !form.amount) {
      setErr("Project, client name, and amount are required.");
      return;
    }
    setSaving(true);
    setErr("");
    try {
      await api.payments.create({ ...form, amount: Number(form.amount) });
      onSaved();
      onClose();
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Failed to save.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-5 border-b border-slate-100">
          <h2 className="font-bold text-slate-900 text-lg">Add Payment Received</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X className="w-5 h-5" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {err && <p className="text-red-600 text-sm bg-red-50 rounded-lg p-3">{err}</p>}

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Project *</label>
            <select
              value={form.project}
              onChange={(e) => set("project", e.target.value)}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-400"
              required
            >
              <option value="">Select project...</option>
              {projects.map((p) => <option key={p._id} value={p._id}>{p.name}</option>)}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Client Name *</label>
              <input
                type="text"
                value={form.clientName}
                onChange={(e) => set("clientName", e.target.value)}
                placeholder="Client name..."
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-400"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Payment Mode</label>
              <select
                value={form.paymentMode}
                onChange={(e) => set("paymentMode", e.target.value)}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-400"
              >
                <option value="cash">Cash</option>
                <option value="bank">Bank Transfer</option>
                <option value="upi">UPI</option>
                <option value="cheque">Cheque</option>
                <option value="razorpay">Razorpay</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Amount (₹) *</label>
              <input
                type="number" min="0" step="0.01"
                value={form.amount}
                onChange={(e) => set("amount", e.target.value)}
                placeholder="0"
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-400"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Date *</label>
              <input
                type="date"
                value={form.date}
                onChange={(e) => set("date", e.target.value)}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-400"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Milestone (optional)</label>
            <input
              type="text"
              value={form.milestone}
              onChange={(e) => set("milestone", e.target.value)}
              placeholder="e.g. Foundation complete..."
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-400"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Transaction Reference (optional)</label>
            <input
              type="text"
              value={form.reference}
              onChange={(e) => set("reference", e.target.value)}
              placeholder="UTR / Cheque number..."
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-400"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Notes (optional)</label>
            <textarea
              value={form.notes}
              onChange={(e) => set("notes", e.target.value)}
              rows={2}
              placeholder="Additional notes..."
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-400 resize-none"
            />
          </div>

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 px-4 py-2.5 border border-slate-200 rounded-xl text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors">
              Cancel
            </button>
            <button type="submit" disabled={saving} className="flex-1 px-4 py-2.5 bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white rounded-xl text-sm font-semibold transition-colors">
              {saving ? "Saving..." : "Add Payment"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Edit Payment Modal ─────────────────────────────────────────────────────────
export function EditPaymentModal({
  payment,
  projects,
  onClose,
  onSaved,
}: {
  payment: PaymentReceived;
  projects: Project[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const projectId = typeof payment.project === "object" ? payment.project._id : payment.project as string;
  const [form, setForm] = useState({
    project: projectId,
    clientName: payment.clientName,
    amount: String(payment.amount),
    date: payment.date.split("T")[0],
    paymentMode: payment.paymentMode,
    milestone: payment.milestone ?? "",
    reference: payment.reference ?? "",
    notes: payment.notes ?? "",
  });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.project || !form.clientName || !form.amount) {
      setErr("Project, client name, and amount are required.");
      return;
    }
    setSaving(true);
    setErr("");
    try {
      await api.payments.update(payment._id, { ...form, amount: Number(form.amount) });
      onSaved();
      onClose();
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Failed to save.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-5 border-b border-slate-100">
          <h2 className="font-bold text-slate-900 text-lg">Edit Payment</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X className="w-5 h-5" /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {err && <p className="text-red-600 text-sm bg-red-50 rounded-lg p-3">{err}</p>}

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Project *</label>
            <select value={form.project} onChange={(e) => set("project", e.target.value)}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-400" required>
              <option value="">Select project...</option>
              {projects.map((p) => <option key={p._id} value={p._id}>{p.name}</option>)}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Client Name *</label>
              <input type="text" value={form.clientName} onChange={(e) => set("clientName", e.target.value)}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-400" required />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Payment Mode</label>
              <select value={form.paymentMode} onChange={(e) => set("paymentMode", e.target.value)}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-400">
                <option value="cash">Cash</option>
                <option value="bank">Bank Transfer</option>
                <option value="upi">UPI</option>
                <option value="cheque">Cheque</option>
                <option value="razorpay">Razorpay</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Amount (₹) *</label>
              <input type="number" min="0" step="0.01" value={form.amount} onChange={(e) => set("amount", e.target.value)}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-400" required />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Date *</label>
              <input type="date" value={form.date} onChange={(e) => set("date", e.target.value)}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-400" required />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Milestone (optional)</label>
            <input type="text" value={form.milestone} onChange={(e) => set("milestone", e.target.value)}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-400" />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Transaction Reference (optional)</label>
            <input type="text" value={form.reference} onChange={(e) => set("reference", e.target.value)}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-400" />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Notes (optional)</label>
            <textarea value={form.notes} onChange={(e) => set("notes", e.target.value)} rows={2}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-400 resize-none" />
          </div>

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 px-4 py-2.5 border border-slate-200 rounded-xl text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors">
              Cancel
            </button>
            <button type="submit" disabled={saving} className="flex-1 px-4 py-2.5 bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white rounded-xl text-sm font-semibold transition-colors">
              {saving ? "Saving..." : "Save Changes"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
