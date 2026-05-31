"use client";

import { useState, useEffect } from "react";
import { Receipt, Plus, CheckCircle, Clock, AlertCircle, Loader2, FileText } from "lucide-react";
import { api, type Invoice, type Project } from "@/lib/api";

const STATUS: Record<string, { label: string; color: string; icon: React.ComponentType<{ className?: string }> }> = {
  sent:     { label: "Sent",     color: "bg-blue-100 text-blue-700",   icon: Clock },
  paid:     { label: "Paid",     color: "bg-green-100 text-green-700", icon: CheckCircle },
  overdue:  { label: "Overdue",  color: "bg-red-100 text-red-700",     icon: AlertCircle },
  draft:    { label: "Draft",    color: "bg-slate-100 text-slate-600", icon: FileText },
  partial:  { label: "Partial",  color: "bg-yellow-100 text-yellow-700", icon: Clock },
};

function fmt(n: number) { return `₹${n.toLocaleString("en-IN")}`; }

export default function BillingPage() {
  const [invoices, setInvoices]   = useState<Invoice[]>([]);
  const [projects, setProjects]   = useState<Project[]>([]);
  const [loading, setLoading]     = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving]       = useState(false);
  const [form, setForm] = useState({ project: "", clientName: "", milestone: "", amount: "", dueDate: "" });

  useEffect(() => {
    Promise.all([api.invoices.list(), api.projects.list()])
      .then(([inv, proj]) => { setInvoices(inv.data); setProjects(proj.data); })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const totalRevenue = invoices.filter(i => i.status === "paid").reduce((s, i) => s + i.totalAmount, 0);
  const totalPending = invoices.filter(i => i.status !== "paid").reduce((s, i) => s + i.balanceAmount, 0);
  const totalOverdue = invoices.filter(i => i.status === "overdue").reduce((s, i) => s + i.balanceAmount, 0);

  const handleCreate = async () => {
    if (!form.project || !form.clientName || !form.amount) return;
    setSaving(true);
    try {
      const amount = parseFloat(form.amount);
      const dueDate = form.dueDate || new Date(Date.now() + 15 * 86400000).toISOString().split("T")[0];
      const inv = await api.invoices.create({
        project: form.project,
        clientName: form.clientName,
        milestone: form.milestone,
        items: [
          {
            description: form.milestone || "Invoice item",
            quantity: 1,
            rate: amount,
            amount,
          },
        ],
        invoiceDate: new Date().toISOString().split("T")[0],
        dueDate,
        status: "draft",
      });
      setInvoices((prev) => [inv.data, ...prev]);
      setShowModal(false);
      setForm({ project: "", clientName: "", milestone: "", amount: "", dueDate: "" });
    } catch (err) { console.error(err); }
    finally { setSaving(false); }
  };

  const markPaid = async (id: string) => {
    try {
      const inv = await api.invoices.update(id, { status: "paid" });
      setInvoices((prev) => prev.map(i => i._id === id ? inv.data : i));
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
          <h1 className="text-2xl font-bold text-slate-900">Billing & Invoicing</h1>
          <p className="text-slate-500 text-sm">GST-ready invoice management</p>
        </div>
        <button onClick={() => setShowModal(true)}
          className="flex items-center gap-2 px-4 py-2.5 bg-orange-500 hover:bg-orange-600 text-white rounded-xl text-sm font-semibold">
          <Plus className="w-4 h-4" /> New Invoice
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-green-50 border border-green-100 rounded-2xl p-4">
          <div className="text-xs text-green-600 font-medium mb-1">Revenue Collected</div>
          <div className="text-xl font-black text-green-700">{fmt(totalRevenue)}</div>
        </div>
        <div className="bg-blue-50 border border-blue-100 rounded-2xl p-4">
          <div className="text-xs text-blue-600 font-medium mb-1">Pending Invoices</div>
          <div className="text-xl font-black text-blue-700">{fmt(totalPending)}</div>
        </div>
        <div className="bg-red-50 border border-red-100 rounded-2xl p-4">
          <div className="text-xs text-red-500 font-medium mb-1">Overdue Amount</div>
          <div className="text-xl font-black text-red-600">{fmt(totalOverdue)}</div>
        </div>
      </div>

      {/* Invoices table */}
      {invoices.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-12 text-center">
          <Receipt className="w-10 h-10 text-slate-300 mx-auto mb-3" />
          <p className="text-slate-500 font-medium">No invoices yet</p>
          <p className="text-slate-400 text-sm mt-1">Create your first invoice to get started.</p>
          <button onClick={() => setShowModal(true)}
            className="mt-4 px-4 py-2 bg-orange-500 text-white rounded-xl text-sm font-semibold hover:bg-orange-600">
            Create Invoice
          </button>
        </div>
      ) : (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100">
                  {["Invoice #", "Client", "Project", "Milestone", "Amount", "GST (18%)", "Total", "Due Date", "Status", ""].map((h) => (
                    <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {invoices.map((inv) => {
                  const sc = STATUS[inv.status] || STATUS.sent;
                  return (
                    <tr key={inv._id} className="hover:bg-slate-50">
                      <td className="px-4 py-3 font-mono text-sm font-bold text-slate-900">{inv.invoiceNumber}</td>
                      <td className="px-4 py-3 text-sm text-slate-700">{inv.clientName}</td>
                      <td className="px-4 py-3 text-sm text-slate-600">{inv.project?.name || "—"}</td>
                      <td className="px-4 py-3 text-sm text-slate-600">{inv.milestone || "—"}</td>
                      <td className="px-4 py-3 text-sm text-slate-700">{fmt(inv.subtotal)}</td>
                      <td className="px-4 py-3 text-sm text-slate-600">{fmt(inv.gstAmount)}</td>
                      <td className="px-4 py-3 font-bold text-slate-900 text-sm">{fmt(inv.totalAmount)}</td>
                      <td className={`px-4 py-3 text-sm ${inv.status === "overdue" ? "text-red-600 font-semibold" : "text-slate-600"}`}>
                        {inv.dueDate ? new Date(inv.dueDate).toLocaleDateString("en-IN") : "—"}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`text-xs px-2.5 py-1 rounded-full font-medium flex items-center gap-1 w-fit ${sc.color}`}>
                          <sc.icon className="w-3 h-3" />{sc.label}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {inv.status !== "paid" && (
                          <button onClick={() => markPaid(inv._id)}
                            className="text-xs bg-green-500 hover:bg-green-600 text-white px-2.5 py-1 rounded-lg transition-colors">
                            Mark Paid
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* New Invoice Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg">
            <div className="flex items-center justify-between p-5 border-b border-slate-100">
              <h2 className="font-bold text-slate-900">Create GST Invoice</h2>
              <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-slate-600">✕</button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Project</label>
                <select value={form.project} onChange={(e) => setForm({ ...form, project: e.target.value })}
                  className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-orange-500">
                  <option value="">Select project</option>
                  {projects.map(p => <option key={p._id} value={p._id}>{p.name}</option>)}
                </select>
              </div>
              {[
                { key: "clientName", label: "Client Name", placeholder: "Client name" },
                { key: "milestone", label: "Milestone / Work Description", placeholder: "e.g. Foundation work completed" },
                { key: "amount",    label: "Amount (₹)", placeholder: "e.g. 500000" },
                { key: "dueDate",   label: "Payment Due Date", placeholder: "", type: "date" },
              ].map((f) => (
                <div key={f.key}>
                  <label className="block text-sm font-medium text-slate-700 mb-1">{f.label}</label>
                  <input type={f.type || "text"} placeholder={f.placeholder}
                    value={form[f.key as keyof typeof form]}
                    onChange={(e) => setForm({ ...form, [f.key]: e.target.value })}
                    className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-orange-500" />
                </div>
              ))}
              {form.amount && (
                <div className="bg-blue-50 rounded-xl p-3 text-sm text-blue-700">
                  GST @ 18%: {fmt(parseFloat(form.amount || "0") * 0.18)} · Total: {fmt(parseFloat(form.amount || "0") * 1.18)}
                </div>
              )}
            </div>
            <div className="flex gap-3 p-5 border-t border-slate-100">
              <button onClick={() => setShowModal(false)}
                className="flex-1 py-2.5 border border-slate-200 rounded-xl text-slate-600 text-sm font-medium hover:bg-slate-50">Cancel</button>
              <button onClick={handleCreate} disabled={saving || !form.project || !form.clientName || !form.amount}
                className="flex-1 py-2.5 bg-orange-500 hover:bg-orange-600 text-white rounded-xl text-sm font-semibold disabled:opacity-60">
                {saving ? "Saving..." : "Generate Invoice"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
