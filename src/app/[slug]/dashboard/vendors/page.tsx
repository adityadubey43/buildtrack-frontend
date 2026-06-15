"use client";

import { useState, useEffect, useCallback } from "react";
import { api, type VendorSummary, type VendorLedger, type VendorBill, type Expense } from "@/lib/api";
import { Plus, X, Store, ArrowLeft, AlertCircle, CheckCircle, Clock, Pencil } from "lucide-react";

function fmt(n: number) {
  if (n >= 10000000) return `₹${(n / 10000000).toFixed(1)} Cr`;
  if (n >= 100000)   return `₹${(n / 100000).toFixed(1)} L`;
  return `₹${n.toLocaleString("en-IN")}`;
}
function fmtDate(d: string) {
  return new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "2-digit" });
}

// ── Add / Edit Vendor Modal ────────────────────────────────────────────────────
function VendorModal({
  initial,
  onClose,
  onSaved,
}: {
  initial?: VendorSummary;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState({
    name: initial?.name ?? "", phone: initial?.phone ?? "",
    gstNumber: initial?.gstNumber ?? "", address: initial?.address ?? "", notes: initial?.notes ?? "",
  });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");
  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) { setErr("Vendor name is required."); return; }
    setSaving(true); setErr("");
    try {
      if (initial) await api.vendors.update(initial._id, form);
      else await api.vendors.create(form);
      onSaved(); onClose();
    } catch (e: unknown) { setErr(e instanceof Error ? e.message : "Failed to save."); }
    finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between p-5 border-b border-slate-100">
          <h2 className="font-bold text-slate-900 text-lg">{initial ? "Edit Vendor" : "Add Vendor"}</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X className="w-5 h-5" /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {err && <p className="text-red-600 text-sm bg-red-50 rounded-lg p-3">{err}</p>}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Name *</label>
            <input type="text" value={form.name} onChange={(e) => set("name", e.target.value)} required
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Phone</label>
              <input type="text" value={form.phone} onChange={(e) => set("phone", e.target.value)}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">GST Number</label>
              <input type="text" value={form.gstNumber} onChange={(e) => set("gstNumber", e.target.value)}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400" />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Address</label>
            <input type="text" value={form.address} onChange={(e) => set("address", e.target.value)}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Notes</label>
            <textarea value={form.notes} onChange={(e) => set("notes", e.target.value)} rows={2}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 resize-none" />
          </div>
          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose}
              className="flex-1 px-4 py-2.5 border border-slate-200 rounded-xl text-sm font-medium text-slate-700 hover:bg-slate-50">Cancel</button>
            <button type="submit" disabled={saving}
              className="flex-1 px-4 py-2.5 bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white rounded-xl text-sm font-semibold">
              {saving ? "Saving..." : initial ? "Save Changes" : "Add Vendor"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Add Bill Modal ─────────────────────────────────────────────────────────────
function AddBillModal({
  vendorId,
  vendorName,
  onClose,
  onSaved,
}: {
  vendorId: string;
  vendorName: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState({
    amount: "", date: new Date().toISOString().split("T")[0],
    description: "", invoiceNumber: "", notes: "",
  });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");
  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.amount) { setErr("Amount is required."); return; }
    setSaving(true); setErr("");
    try {
      await api.vendors.addBill(vendorId, { ...form, amount: Number(form.amount) });
      onSaved(); onClose();
    } catch (e: unknown) { setErr(e instanceof Error ? e.message : "Failed to save."); }
    finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between p-5 border-b border-slate-100">
          <div>
            <h2 className="font-bold text-slate-900 text-lg">Add Bill</h2>
            <p className="text-xs text-slate-500 mt-0.5">From: {vendorName}</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X className="w-5 h-5" /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {err && <p className="text-red-600 text-sm bg-red-50 rounded-lg p-3">{err}</p>}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Bill Amount (₹) *</label>
              <input type="number" min="0" step="0.01" value={form.amount} onChange={(e) => set("amount", e.target.value)} required
                placeholder="0"
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Bill Date *</label>
              <input type="date" value={form.date} onChange={(e) => set("date", e.target.value)}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400" />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Description</label>
            <input type="text" value={form.description} onChange={(e) => set("description", e.target.value)}
              placeholder="e.g. Plumbing work – Phase 2"
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400" />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Invoice Number</label>
            <input type="text" value={form.invoiceNumber} onChange={(e) => set("invoiceNumber", e.target.value)}
              placeholder="Vendor's invoice / bill number"
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400" />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Notes</label>
            <textarea value={form.notes} onChange={(e) => set("notes", e.target.value)} rows={2}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 resize-none" />
          </div>

          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose}
              className="flex-1 px-4 py-2.5 border border-slate-200 rounded-xl text-sm font-medium text-slate-700 hover:bg-slate-50">Cancel</button>
            <button type="submit" disabled={saving}
              className="flex-1 px-4 py-2.5 bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white rounded-xl text-sm font-semibold">
              {saving ? "Saving..." : "Add Bill"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Ledger View ────────────────────────────────────────────────────────────────
function LedgerView({
  ledger,
  onBack,
  onRefresh,
}: {
  ledger: VendorLedger;
  onBack: () => void;
  onRefresh: () => void;
}) {
  const { vendor, bills, expenses, summary } = ledger;
  const [showAddBill, setShowAddBill] = useState(false);

  const handleDeleteBill = async (billId: string) => {
    if (!confirm("Delete this bill?")) return;
    try {
      await api.vendors.deleteBill(billId);
      onRefresh();
    } catch { alert("Failed to delete bill."); }
  };

  // Merge bills and expenses into one chronological list
  type LedgerRow =
    | { kind: "bill"; date: string; id: string; description: string; ref: string; bill: number; paid: number }
    | { kind: "payment"; date: string; id: string; description: string; ref: string; bill: number; paid: number };

  const rows: LedgerRow[] = [
    ...bills.map((b: VendorBill) => ({
      kind: "bill" as const,
      date: b.date,
      id: b._id,
      description: b.description || "Bill",
      ref: b.invoiceNumber || "",
      bill: b.amount,
      paid: 0,
    })),
    ...expenses.map((e: Expense) => ({
      kind: "payment" as const,
      date: e.date,
      id: e._id,
      description: e.description,
      ref: e.paymentMode || "",
      bill: 0,
      paid: e.amount,
    })),
  ].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  // Running balance after each row
  let running = 0;
  const rowsWithBalance = rows.map((r) => {
    running += r.bill - r.paid;
    return { ...r, balance: running };
  });

  return (
    <>
      {showAddBill && (
        <AddBillModal
          vendorId={vendor._id}
          vendorName={vendor.name}
          onClose={() => setShowAddBill(false)}
          onSaved={() => { setShowAddBill(false); onRefresh(); }}
        />
      )}

      <div className="p-4 lg:p-6 space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={onBack} className="p-2 hover:bg-slate-100 rounded-lg transition-colors text-slate-500">
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <h1 className="text-xl font-bold text-slate-900">{vendor.name}</h1>
              <p className="text-slate-500 text-sm">
                {vendor.phone ?? ""}
                {vendor.gstNumber ? ` · GST: ${vendor.gstNumber}` : ""}
              </p>
            </div>
          </div>
          <button
            onClick={() => setShowAddBill(true)}
            className="flex items-center gap-2 px-4 py-2.5 bg-orange-500 hover:bg-orange-600 text-white rounded-xl text-sm font-semibold shadow-lg shadow-orange-500/30"
          >
            <Plus className="w-4 h-4" /> Add Bill
          </button>
        </div>

        {/* Summary strip */}
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-center">
            <div className="text-xs text-slate-500 font-medium mb-0.5">Total Billed</div>
            <div className="text-lg font-black text-slate-800">{fmt(summary.totalBilled)}</div>
          </div>
          <div className="bg-green-50 border border-green-100 rounded-xl p-3 text-center">
            <div className="text-xs text-green-600 font-medium mb-0.5">Total Paid</div>
            <div className="text-lg font-black text-green-700">{fmt(summary.totalPaid)}</div>
          </div>
          <div className={`rounded-xl p-3 text-center border ${summary.outstanding <= 0 ? "bg-green-50 border-green-100" : "bg-red-50 border-red-100"}`}>
            <div className={`text-xs font-medium mb-0.5 ${summary.outstanding <= 0 ? "text-green-600" : "text-red-500"}`}>Outstanding</div>
            <div className={`text-lg font-black ${summary.outstanding <= 0 ? "text-green-700" : "text-red-600"}`}>
              {summary.outstanding <= 0 ? "Cleared" : fmt(summary.outstanding)}
            </div>
          </div>
        </div>

        {/* Tally-style unified ledger */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-800 text-white text-xs uppercase font-semibold">
                  <th className="px-4 py-3 text-left">Date</th>
                  <th className="px-4 py-3 text-left">Particulars</th>
                  <th className="px-4 py-3 text-left">Ref / Mode</th>
                  <th className="px-4 py-3 text-right">Bill (Dr)</th>
                  <th className="px-4 py-3 text-right">Paid (Cr)</th>
                  <th className="px-4 py-3 text-right">Balance</th>
                  <th className="px-3 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {rowsWithBalance.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-10 text-center text-slate-400 text-sm">
                      No transactions yet.{" "}
                      <button onClick={() => setShowAddBill(true)} className="text-orange-500 hover:underline">Add first bill →</button>
                    </td>
                  </tr>
                ) : rowsWithBalance.map((row) => (
                  <tr key={row.id} className={`hover:bg-slate-50 ${row.kind === "bill" ? "" : "bg-green-50/30"}`}>
                    <td className="px-4 py-3 text-slate-500 whitespace-nowrap text-xs">{fmtDate(row.date)}</td>
                    <td className="px-4 py-3 max-w-[180px]">
                      <div className="flex items-center gap-1.5">
                        <span className={`inline-block w-1.5 h-1.5 rounded-full flex-shrink-0 ${row.kind === "bill" ? "bg-orange-400" : "bg-green-500"}`} />
                        <span className="text-slate-800 truncate">{row.description}</span>
                      </div>
                      <div className="text-xs text-slate-400 ml-3">{row.kind === "bill" ? "Bill" : "Payment"}</div>
                    </td>
                    <td className="px-4 py-3 text-slate-400 text-xs">{row.ref || "—"}</td>
                    <td className="px-4 py-3 text-right font-medium">
                      {row.bill > 0 ? <span className="text-slate-900">{fmt(row.bill)}</span> : <span className="text-slate-200">—</span>}
                    </td>
                    <td className="px-4 py-3 text-right font-medium">
                      {row.paid > 0 ? <span className="text-green-600">{fmt(row.paid)}</span> : <span className="text-slate-200">—</span>}
                    </td>
                    <td className="px-4 py-3 text-right font-semibold">
                      <span className={row.balance > 0 ? "text-red-500" : row.balance < 0 ? "text-green-600" : "text-slate-400"}>
                        {row.balance === 0 ? "Nil" : fmt(Math.abs(row.balance))}
                        {row.balance > 0 ? " Dr" : row.balance < 0 ? " Cr" : ""}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-right">
                      {row.kind === "bill" && (
                        <button onClick={() => handleDeleteBill(row.id)}
                          className="text-slate-200 hover:text-red-500 transition-colors">
                          <X className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-slate-800 text-white font-bold text-sm border-t-2 border-slate-300">
                  <td colSpan={3} className="px-4 py-3">Closing Balance</td>
                  <td className="px-4 py-3 text-right">{fmt(summary.totalBilled)}</td>
                  <td className="px-4 py-3 text-right text-green-300">{fmt(summary.totalPaid)}</td>
                  <td className="px-4 py-3 text-right">
                    <span className={summary.outstanding > 0 ? "text-red-300" : "text-green-300"}>
                      {summary.outstanding === 0 ? "Nil" : fmt(Math.abs(summary.outstanding))}
                      {summary.outstanding > 0 ? " Dr" : summary.outstanding < 0 ? " Cr" : ""}
                    </span>
                  </td>
                  <td />
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      </div>
    </>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function VendorsPage() {
  const [vendors, setVendors]       = useState<VendorSummary[]>([]);
  const [loading, setLoading]       = useState(true);
  const [migrating, setMigrating]   = useState(false);
  const [showModal, setShowModal]   = useState(false);
  const [editVendor, setEditVendor] = useState<VendorSummary | undefined>();
  const [ledger, setLedger]         = useState<VendorLedger | null>(null);
  const [ledgerLoading, setLedgerLoading] = useState(false);

  const loadVendors = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.vendors.summary();
      setVendors(res.data);
    } catch { setVendors([]); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { loadVendors(); }, [loadVendors]);

  const openLedger = async (vendorId: string) => {
    setLedgerLoading(true);
    try {
      const res = await api.vendors.ledger(vendorId);
      setLedger(res.data);
    } catch { /* ignore */ }
    finally { setLedgerLoading(false); }
  };

  const refreshLedger = useCallback(async () => {
    if (!ledger) return;
    try {
      const res = await api.vendors.ledger(ledger.vendor._id);
      setLedger(res.data);
      // also refresh summary totals in list
      loadVendors();
    } catch { /* ignore */ }
  }, [ledger, loadVendors]);

  const handleMigrate = async () => {
    setMigrating(true);
    try {
      const res = await api.vendors.migrate();
      alert(res.message);
      await loadVendors();
    } catch { alert("Migration failed."); }
    finally { setMigrating(false); }
  };

  if (ledger) {
    return <LedgerView ledger={ledger} onBack={() => setLedger(null)} onRefresh={refreshLedger} />;
  }

  const totalOutstanding = vendors.reduce((s, v) => s + Math.max(0, v.outstanding), 0);
  const totalBilled      = vendors.reduce((s, v) => s + v.totalBilled, 0);
  const totalPaid        = vendors.reduce((s, v) => s + v.totalPaid, 0);

  return (
    <>
      {(showModal || editVendor) && (
        <VendorModal
          initial={editVendor}
          onClose={() => { setShowModal(false); setEditVendor(undefined); }}
          onSaved={() => { setShowModal(false); setEditVendor(undefined); loadVendors(); }}
        />
      )}

      <div className="p-4 lg:p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Vendors</h1>
            <p className="text-slate-500 text-sm mt-0.5">Track bills received and payments made</p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={handleMigrate} disabled={migrating}
              className="px-3 py-2 text-xs border border-slate-200 rounded-xl text-slate-600 hover:bg-slate-50 disabled:opacity-50"
              title="Pull in vendor names from existing expense entries">
              {migrating ? "Importing..." : "Import from Expenses"}
            </button>
            <button onClick={() => setShowModal(true)}
              className="flex items-center gap-2 px-4 py-2.5 bg-orange-500 hover:bg-orange-600 text-white rounded-xl text-sm font-semibold shadow-lg shadow-orange-500/30">
              <Plus className="w-4 h-4" /> Add Vendor
            </button>
          </div>
        </div>

        {/* Summary strip */}
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 text-center">
            <div className="text-xs text-slate-500 font-medium mb-1">Total Billed</div>
            <div className="text-xl font-black text-slate-800">{fmt(totalBilled)}</div>
          </div>
          <div className="bg-green-50 border border-green-100 rounded-2xl p-4 text-center">
            <div className="text-xs text-green-600 font-medium mb-1">Total Paid</div>
            <div className="text-xl font-black text-green-700">{fmt(totalPaid)}</div>
          </div>
          <div className={`rounded-2xl p-4 text-center border ${totalOutstanding > 0 ? "bg-red-50 border-red-100" : "bg-green-50 border-green-100"}`}>
            <div className={`text-xs font-medium mb-1 ${totalOutstanding > 0 ? "text-red-500" : "text-green-600"}`}>Total Outstanding</div>
            <div className={`text-xl font-black ${totalOutstanding > 0 ? "text-red-600" : "text-green-700"}`}>{fmt(totalOutstanding)}</div>
          </div>
        </div>

        {/* Vendor list */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="p-4 border-b border-slate-100">
            <h2 className="font-bold text-slate-900">All Vendors</h2>
          </div>

          {loading ? (
            <div className="p-5 space-y-3">
              {Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-14 bg-slate-100 rounded-lg animate-pulse" />)}
            </div>
          ) : vendors.length === 0 ? (
            <div className="p-12 text-center text-slate-400">
              <Store className="w-10 h-10 mx-auto mb-3 opacity-30" />
              <p className="text-sm">No vendors yet.</p>
              <p className="text-xs mt-1">Add a vendor or use &quot;Import from Expenses&quot; to pull in names from existing entries.</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-50">
              {vendors.map((v) => {
                const isAdvance  = v.totalBilled === 0 && v.totalPaid > 0;
                const isCleared  = v.totalBilled === 0 && v.totalPaid === 0;
                const isFullPaid = v.totalBilled > 0 && v.totalPaid >= v.totalBilled;
                const isPartial  = v.totalBilled > 0 && v.totalPaid > 0 && v.totalPaid < v.totalBilled;
                return (
                  <div key={v._id}
                    className="flex items-center gap-4 px-4 lg:px-5 py-4 hover:bg-slate-50 transition-colors cursor-pointer"
                    onClick={() => !ledgerLoading && openLedger(v._id)}
                  >
                    <div className="w-10 h-10 bg-orange-100 rounded-xl flex items-center justify-center flex-shrink-0">
                      <Store className="w-5 h-5 text-orange-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-slate-900">{v.name}</p>
                      <p className="text-xs text-slate-400">
                        {v.phone ? v.phone : ""}
                        {v.phone && v.gstNumber ? " · " : ""}
                        {v.gstNumber ? `GST: ${v.gstNumber}` : ""}
                        {!v.phone && !v.gstNumber
                          ? `${v.billCount} bill${v.billCount !== 1 ? "s" : ""} · ${v.expenseCount} payment${v.expenseCount !== 1 ? "s" : ""}`
                          : ""}
                      </p>
                    </div>

                    <div className="hidden sm:flex items-center gap-6 text-right">
                      <div>
                        <p className="text-xs text-slate-400">Billed</p>
                        <p className="text-sm font-medium text-slate-700">{fmt(v.totalBilled)}</p>
                      </div>
                      <div>
                        <p className="text-xs text-slate-400">Paid</p>
                        <p className="text-sm font-medium text-green-600">{fmt(v.totalPaid)}</p>
                      </div>
                      <div className="min-w-[80px]">
                        <p className="text-xs text-slate-400">Outstanding</p>
                        <p className={`text-sm font-bold ${isAdvance ? "text-blue-600" : (isCleared || isFullPaid) ? "text-green-600" : "text-red-600"}`}>
                          {isAdvance ? `Adv ${fmt(v.totalPaid)}` : (isCleared || isFullPaid) ? "Cleared" : fmt(v.outstanding)}
                        </p>
                      </div>
                    </div>

                    <div className="flex-shrink-0">
                      {isAdvance ? (
                        <span className="flex items-center gap-1 text-xs bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full font-medium">
                          <CheckCircle className="w-3 h-3" /> Advance
                        </span>
                      ) : isCleared ? (
                        <span className="flex items-center gap-1 text-xs bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full font-medium">
                          <CheckCircle className="w-3 h-3" /> Cleared
                        </span>
                      ) : isFullPaid ? (
                        <span className="flex items-center gap-1 text-xs bg-green-50 text-green-600 px-2 py-0.5 rounded-full font-medium">
                          <CheckCircle className="w-3 h-3" /> Paid
                        </span>
                      ) : isPartial ? (
                        <span className="flex items-center gap-1 text-xs bg-yellow-50 text-yellow-600 px-2 py-0.5 rounded-full font-medium">
                          <Clock className="w-3 h-3" /> Partial
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 text-xs bg-red-50 text-red-600 px-2 py-0.5 rounded-full font-medium">
                          <AlertCircle className="w-3 h-3" /> Unpaid
                        </span>
                      )}
                    </div>

                    <button onClick={(e) => { e.stopPropagation(); setEditVendor(v); }}
                      className="text-slate-300 hover:text-blue-500 transition-colors flex-shrink-0">
                      <Pencil className="w-4 h-4" />
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
