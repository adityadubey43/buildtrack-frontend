"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  Receipt, Plus, CheckCircle, Clock, AlertCircle, Loader2, FileText,
  X, Trash2, ChevronDown, ChevronUp, Eye,
} from "lucide-react";
import { api, type Invoice, type Project, type InvoiceItem, type InvoiceInput } from "@/lib/api";

function fmtINR(n: number) {
  return "₹" + n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtDate(d?: string) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

const STATUS: Record<string, { label: string; color: string; Icon: React.ComponentType<{ className?: string }> }> = {
  draft:            { label: "Draft",    color: "bg-slate-100 text-slate-600",    Icon: FileText },
  sent:             { label: "Sent",     color: "bg-blue-100 text-blue-700",      Icon: Clock },
  "partially-paid": { label: "Partial",  color: "bg-yellow-100 text-yellow-700",  Icon: Clock },
  paid:             { label: "Paid",     color: "bg-green-100 text-green-700",    Icon: CheckCircle },
  overdue:          { label: "Overdue",  color: "bg-red-100 text-red-700",        Icon: AlertCircle },
  cancelled:        { label: "Cancelled",color: "bg-slate-100 text-slate-500",    Icon: X },
};

const UNITS = ["nos", "sqft", "rft", "rm", "kg", "ton", "ls", "bag", "m³", "m²", "cum", "cft"];
const GST_RATES = [0, 5, 12, 18, 28];
const WORK_TYPES = [
  { value: "labour",   label: "Labour Work" },
  { value: "material", label: "Material Supply" },
  { value: "turnkey",  label: "Turnkey" },
  { value: "pmc",      label: "Project Management (PMC)" },
  { value: "supply",   label: "Supply" },
  { value: "other",    label: "Other" },
];
const RECURRING_TYPES = [
  { value: "one-time",  label: "One-time Invoice" },
  { value: "milestone", label: "Milestone Based" },
  { value: "monthly",   label: "Monthly Recurring" },
  { value: "weekly",    label: "Weekly Recurring" },
];

type ItemRow = InvoiceItem & { id: number };
type AddCharge = { id: number; label: string; amount: string };

const newItem = (id: number): ItemRow => ({ id, description: "", hsnCode: "", unit: "nos", quantity: 1, rate: 0, amount: 0, gstRate: 18 });

function calcTotals(
  items: ItemRow[],
  discountType: string, discountValue: number,
  additionalCharges: AddCharge[],
  tdsRate: number, gstType: "intra" | "inter"
) {
  const subtotal = items.reduce((s, i) => s + (i.quantity * i.rate), 0);
  let discountAmount = 0;
  if (discountType === "pct") discountAmount = (subtotal * discountValue) / 100;
  else if (discountType === "fixed") discountAmount = discountValue;
  discountAmount = Math.min(discountAmount, subtotal);
  const taxableAmount = subtotal - discountAmount;

  // Group by GST rate
  const groups: Record<number, number> = {};
  for (const item of items) {
    const rate = item.gstRate ?? 18;
    const itemTaxable = (item.quantity * item.rate) - (subtotal > 0 ? ((item.quantity * item.rate) / subtotal) * discountAmount : 0);
    groups[rate] = (groups[rate] || 0) + itemTaxable;
  }

  let totalTax = 0;
  const taxLines: { gstRate: number; taxableAmount: number; cgstRate: number; cgstAmount: number; sgstRate: number; sgstAmount: number; igstRate: number; igstAmount: number }[] = [];
  for (const [rateStr, taxable] of Object.entries(groups)) {
    const gstRate = Number(rateStr);
    if (gstType === "intra") {
      const half = (taxable * gstRate / 2) / 100;
      taxLines.push({ gstRate, taxableAmount: taxable, cgstRate: gstRate / 2, cgstAmount: half, sgstRate: gstRate / 2, sgstAmount: half, igstRate: 0, igstAmount: 0 });
      totalTax += half * 2;
    } else {
      const igst = (taxable * gstRate) / 100;
      taxLines.push({ gstRate, taxableAmount: taxable, cgstRate: 0, cgstAmount: 0, sgstRate: 0, sgstAmount: 0, igstRate: gstRate, igstAmount: igst });
      totalTax += igst;
    }
  }

  const addTotal = additionalCharges.reduce((s, c) => s + (parseFloat(c.amount) || 0), 0);
  const tdsAmount = ((taxableAmount + totalTax) * tdsRate) / 100;
  const raw = taxableAmount + totalTax + addTotal - tdsAmount;
  const roundOff = Math.round(raw) - raw;
  const total = raw + roundOff;

  return { subtotal, discountAmount, taxableAmount, taxLines, totalTax, addTotal, tdsAmount, roundOff, total };
}

export default function BillingPage() {
  const params = useParams();
  const router = useRouter();
  const slug = params.slug as string;

  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [summary, setSummary] = useState({ total: 0, paid: 0, pending: 0, overdue: 0 });
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");

  // Payment modal state
  const [paymentInvoice, setPaymentInvoice] = useState<Invoice | null>(null);
  const [paymentForm, setPaymentForm] = useState({ amount: "", date: "", mode: "bank", reference: "", notes: "" });
  const [paymentSaving, setPaymentSaving] = useState(false);
  const [paymentError, setPaymentError] = useState("");

  // New invoice form state
  const [clientName, setClientName] = useState("");
  const [clientAddress, setClientAddress] = useState("");
  const [clientGstin, setClientGstin] = useState("");
  const [clientPhone, setClientPhone] = useState("");
  const [clientEmail, setClientEmail] = useState("");
  const [project, setProject] = useState("");
  const [siteName, setSiteName] = useState("");
  const [siteLocation, setSiteLocation] = useState("");
  const [workType, setWorkType] = useState("other");
  const [invoiceDate, setInvoiceDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [dueDate, setDueDate] = useState(() => {
    const d = new Date(); d.setDate(d.getDate() + 15);
    return d.toISOString().split("T")[0];
  });
  const [recurringType, setRecurringType] = useState("one-time");
  const [milestone, setMilestone] = useState("");
  const [items, setItems] = useState<ItemRow[]>([newItem(1)]);
  const [nextId, setNextId] = useState(2);
  const [discountType, setDiscountType] = useState("none");
  const [discountValue, setDiscountValue] = useState(0);
  const [additionalCharges, setAdditionalCharges] = useState<AddCharge[]>([]);
  const [nextChargeId, setNextChargeId] = useState(1);
  const [tdsRate, setTdsRate] = useState(0);
  const [gstTypeOverride, setGstTypeOverride] = useState<"auto" | "intra" | "inter">("auto");
  const [terms, setTerms] = useState("");
  const [notes, setNotes] = useState("");
  const [paymentInstructions, setPaymentInstructions] = useState("");
  const [tenantGstin, setTenantGstin] = useState("");
  const [showAdvanced, setShowAdvanced] = useState(false);

  const resolvedGstType = useCallback((): "intra" | "inter" => {
    if (gstTypeOverride !== "auto") return gstTypeOverride;
    if (!tenantGstin || !clientGstin) return "intra";
    return tenantGstin.substring(0, 2) === clientGstin.substring(0, 2) ? "intra" : "inter";
  }, [gstTypeOverride, tenantGstin, clientGstin]);

  const totals = calcTotals(items, discountType, discountValue, additionalCharges, tdsRate, resolvedGstType());

  useEffect(() => {
    Promise.all([api.invoices.list(), api.projects.list(), api.invoices.summary(), api.invoices.getSettings()])
      .then(([inv, proj, sum, settings]) => {
        setInvoices([...inv.data].sort((a, b) => new Date(b.invoiceDate).getTime() - new Date(a.invoiceDate).getTime()));
        setProjects(proj.data);
        setSummary(sum.data);
        if (settings.data?.gstin) setTenantGstin(settings.data.gstin);
        if (settings.data?.defaultTerms) setTerms(settings.data.defaultTerms);
        if (settings.data?.defaultPaymentInstructions) setPaymentInstructions(settings.data.defaultPaymentInstructions);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const resetForm = () => {
    setClientName(""); setClientAddress(""); setClientGstin(""); setClientPhone(""); setClientEmail("");
    setProject(""); setSiteName(""); setSiteLocation(""); setWorkType("other");
    setInvoiceDate(new Date().toISOString().split("T")[0]);
    const d = new Date(); d.setDate(d.getDate() + 15);
    setDueDate(d.toISOString().split("T")[0]);
    setRecurringType("one-time"); setMilestone("");
    setItems([newItem(1)]); setNextId(2);
    setDiscountType("none"); setDiscountValue(0);
    setAdditionalCharges([]); setNextChargeId(1);
    setTdsRate(0); setGstTypeOverride("auto");
    setSaveError(""); setShowAdvanced(false);
  };

  const addItem = () => {
    setItems(prev => [...prev, newItem(nextId)]);
    setNextId(prev => prev + 1);
  };

  const updateItem = (id: number, field: string, value: string | number) => {
    setItems(prev => prev.map(item => {
      if (item.id !== id) return item;
      const updated = { ...item, [field]: value };
      updated.amount = (Number(updated.quantity) || 0) * (Number(updated.rate) || 0);
      return updated;
    }));
  };

  const removeItem = (id: number) => {
    if (items.length === 1) return;
    setItems(prev => prev.filter(i => i.id !== id));
  };

  const addCharge = () => {
    setAdditionalCharges(prev => [...prev, { id: nextChargeId, label: "", amount: "" }]);
    setNextChargeId(prev => prev + 1);
  };

  const handleCreate = async () => {
    if (!clientName.trim()) { setSaveError("Client name is required."); return; }
    if (items.some(i => !i.description.trim())) { setSaveError("All items must have a description."); return; }
    setSaving(true); setSaveError("");
    try {
      const body: InvoiceInput = {
        client: {
          name: clientName.trim(), address: clientAddress, gstin: clientGstin,
          stateCode: clientGstin.length >= 2 ? clientGstin.substring(0, 2) : undefined,
          phone: clientPhone, email: clientEmail,
        },
        invoiceDate, dueDate,
        project: project || undefined,
        siteName: siteName || undefined,
        siteLocation: siteLocation || undefined,
        workType,
        items: items.map(({ id: _id, ...i }) => i),
        discountType: discountType !== "none" ? discountType : "none",
        discountValue,
        gstType: gstTypeOverride !== "auto" ? gstTypeOverride : undefined,
        additionalCharges: additionalCharges.filter(c => c.label && c.amount).map(c => ({ label: c.label, amount: parseFloat(c.amount) || 0 })),
        tdsRate,
        recurring: { type: recurringType, milestone: milestone || undefined },
        terms: terms || undefined,
        notes: notes || undefined,
        paymentInstructions: paymentInstructions || undefined,
      };
      const r = await api.invoices.create(body);
      setInvoices(prev => [r.data, ...prev].sort((a, b) => new Date(b.invoiceDate).getTime() - new Date(a.invoiceDate).getTime()));
      setShowModal(false);
      resetForm();
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : "Failed to create invoice.");
    } finally {
      setSaving(false);
    }
  };

  const submitPayment = async () => {
    if (!paymentInvoice) return;
    setPaymentSaving(true); setPaymentError("");
    try {
      const r = await api.invoices.recordPayment(paymentInvoice._id, {
        amount: parseFloat(paymentForm.amount), date: paymentForm.date, mode: paymentForm.mode,
        reference: paymentForm.reference, notes: paymentForm.notes,
      });
      setInvoices(prev => prev.map(i => i._id === paymentInvoice._id ? r.data : i));
      setPaymentInvoice(null);
      setPaymentError("");
    } catch (e) {
      setPaymentError(e instanceof Error ? e.message : "Payment failed.");
    } finally {
      setPaymentSaving(false);
    }
  };

  if (loading) return (
    <div className="p-6 flex items-center justify-center min-h-64">
      <Loader2 className="w-6 h-6 animate-spin text-orange-500" />
    </div>
  );

  const gstType = resolvedGstType();

  return (
    <div className="p-4 lg:p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Billing & Invoicing</h1>
          <p className="text-slate-500 text-sm">GST-ready invoice management</p>
        </div>
        <button onClick={() => { setShowModal(true); }}
          className="flex items-center gap-2 px-4 py-2.5 bg-orange-500 hover:bg-orange-600 text-white rounded-xl text-sm font-semibold shadow-sm">
          <Plus className="w-4 h-4" /> New Invoice
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {[
          { label: "Total Invoiced",  value: summary.total,   color: "bg-slate-50 border-slate-200 text-slate-700" },
          { label: "Revenue Collected", value: summary.paid,  color: "bg-green-50 border-green-100 text-green-700" },
          { label: "Pending",         value: summary.pending, color: "bg-blue-50 border-blue-100 text-blue-700" },
          { label: "Overdue",         value: summary.overdue, color: "bg-red-50 border-red-100 text-red-600" },
        ].map(s => (
          <div key={s.label} className={`border rounded-2xl p-4 ${s.color}`}>
            <div className="text-xs font-medium mb-1 opacity-70">{s.label}</div>
            <div className="text-xl font-black">{fmtINR(s.value)}</div>
          </div>
        ))}
      </div>

      {/* Invoice list */}
      {invoices.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-12 text-center">
          <Receipt className="w-10 h-10 text-slate-300 mx-auto mb-3" />
          <p className="text-slate-500 font-medium">No invoices yet</p>
          <button onClick={() => setShowModal(true)}
            className="mt-4 px-4 py-2 bg-orange-500 text-white rounded-xl text-sm font-semibold hover:bg-orange-600">
            Create First Invoice
          </button>
        </div>
      ) : (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100">
                  {["Invoice #", "Client", "Project / Site", "Amount", "GST", "Total", "Due Date", "Status", ""].map(h => (
                    <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {invoices.map(inv => {
                  const sc = STATUS[inv.status] || STATUS.draft;
                  const clientDisplayName = inv.client?.name || inv.clientName || "—";
                  const projectName = inv.projectName || inv.project?.name || "—";
                  const taxAmount = inv.totalTax ?? (inv.gstAmount ?? 0);
                  return (
                    <tr key={inv._id} className="hover:bg-slate-50">
                      <td className="px-4 py-3 font-mono text-sm font-bold text-slate-900">{inv.invoiceNumber}</td>
                      <td className="px-4 py-3 text-sm text-slate-700 max-w-[160px] truncate">{clientDisplayName}</td>
                      <td className="px-4 py-3 text-sm text-slate-600 max-w-[160px] truncate">
                        {projectName}{inv.siteName ? ` · ${inv.siteName}` : ""}
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-700">{fmtINR(inv.subtotal)}</td>
                      <td className="px-4 py-3 text-sm text-slate-600">{fmtINR(taxAmount)}</td>
                      <td className="px-4 py-3 font-bold text-slate-900 text-sm">{fmtINR(inv.totalAmount)}</td>
                      <td className={`px-4 py-3 text-sm ${inv.status === "overdue" ? "text-red-600 font-semibold" : "text-slate-600"}`}>
                        {fmtDate(inv.dueDate)}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`text-xs px-2.5 py-1 rounded-full font-medium flex items-center gap-1 w-fit ${sc.color}`}>
                          <sc.Icon className="w-3 h-3" />{sc.label}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1">
                          <button onClick={() => router.push(`/${slug}/dashboard/billing/${inv._id}`)}
                            className="p-1.5 text-slate-400 hover:text-orange-500 hover:bg-orange-50 rounded-lg transition-colors" title="View Invoice">
                            <Eye className="w-4 h-4" />
                          </button>
                          {inv.status !== "paid" && inv.status !== "cancelled" && (
                            <button onClick={() => { setPaymentInvoice(inv); setPaymentForm(f => ({ ...f, amount: String(inv.balanceAmount), date: new Date().toISOString().split("T")[0] })); }}
                              className="text-xs bg-green-500 hover:bg-green-600 text-white px-2.5 py-1 rounded-lg transition-colors whitespace-nowrap">
                              Record Payment
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ─── New Invoice Modal ─── */}
      {showModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-start justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl my-4">
            <div className="flex items-center justify-between p-5 border-b border-slate-100 sticky top-0 bg-white rounded-t-2xl z-10">
              <h2 className="font-bold text-lg text-slate-900">Create GST Invoice</h2>
              <button onClick={() => { setShowModal(false); resetForm(); }} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-6">
              {saveError && <p className="text-red-600 text-sm bg-red-50 rounded-xl p-3">{saveError}</p>}

              {/* Client details */}
              <section>
                <h3 className="text-sm font-bold text-slate-700 uppercase tracking-wide mb-3">Client Details</h3>
                <div className="grid grid-cols-2 gap-3">
                  <div className="col-span-2">
                    <label className="block text-xs font-medium text-slate-600 mb-1">Client Name *</label>
                    <input value={clientName} onChange={e => setClientName(e.target.value)} placeholder="Client / Company Name"
                      className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-500" />
                  </div>
                  <div className="col-span-2">
                    <label className="block text-xs font-medium text-slate-600 mb-1">Address</label>
                    <textarea value={clientAddress} onChange={e => setClientAddress(e.target.value)} placeholder="Billing address" rows={2}
                      className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 resize-none" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">GSTIN</label>
                    <input value={clientGstin} onChange={e => setClientGstin(e.target.value.toUpperCase())} placeholder="27AAAPZ1234N1Z5"
                      className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm font-mono focus:outline-none focus:ring-2 focus:ring-orange-500" />
                    {clientGstin.length >= 2 && tenantGstin.length >= 2 && (
                      <p className={`text-xs mt-1 ${resolvedGstType() === "intra" ? "text-blue-600" : "text-purple-600"}`}>
                        {resolvedGstType() === "intra" ? "Same state → CGST + SGST will apply" : "Different state → IGST will apply"}
                      </p>
                    )}
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">Phone</label>
                    <input value={clientPhone} onChange={e => setClientPhone(e.target.value)} placeholder="+91 9999999999"
                      className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-500" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">Email</label>
                    <input type="email" value={clientEmail} onChange={e => setClientEmail(e.target.value)} placeholder="client@example.com"
                      className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-500" />
                  </div>
                </div>
              </section>

              {/* Invoice meta */}
              <section>
                <h3 className="text-sm font-bold text-slate-700 uppercase tracking-wide mb-3">Invoice Details</h3>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">Invoice Date</label>
                    <input type="date" value={invoiceDate} onChange={e => setInvoiceDate(e.target.value)}
                      className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-500" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">Due Date</label>
                    <input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)}
                      className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-500" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">Project</label>
                    <select value={project} onChange={e => setProject(e.target.value)}
                      className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-500">
                      <option value="">No project</option>
                      {projects.map(p => <option key={p._id} value={p._id}>{p.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">Work Type</label>
                    <select value={workType} onChange={e => setWorkType(e.target.value)}
                      className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-500">
                      {WORK_TYPES.map(w => <option key={w.value} value={w.value}>{w.label}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">Site Name</label>
                    <input value={siteName} onChange={e => setSiteName(e.target.value)} placeholder="e.g. Raj Villa"
                      className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-500" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">Site Location</label>
                    <input value={siteLocation} onChange={e => setSiteLocation(e.target.value)} placeholder="e.g. Sector 21, Noida"
                      className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-500" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">Invoice Type</label>
                    <select value={recurringType} onChange={e => setRecurringType(e.target.value)}
                      className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-500">
                      {RECURRING_TYPES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                    </select>
                  </div>
                  {(recurringType === "milestone") && (
                    <div>
                      <label className="block text-xs font-medium text-slate-600 mb-1">Milestone</label>
                      <input value={milestone} onChange={e => setMilestone(e.target.value)} placeholder="e.g. Plinth Level Completed"
                        className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-500" />
                    </div>
                  )}
                </div>
              </section>

              {/* BOQ Line items */}
              <section>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-bold text-slate-700 uppercase tracking-wide">Line Items (BOQ)</h3>
                  <button onClick={addItem} className="flex items-center gap-1.5 text-xs font-semibold text-orange-600 hover:text-orange-700">
                    <Plus className="w-3.5 h-3.5" /> Add Item
                  </button>
                </div>
                <div className="space-y-2">
                  {/* Header row */}
                  <div className="hidden lg:grid grid-cols-[2fr_1fr_auto_auto_auto_auto_auto] gap-2 text-xs font-semibold text-slate-400 uppercase px-1">
                    <span>Description</span>
                    <span>HSN</span>
                    <span>Unit</span>
                    <span>Qty</span>
                    <span>Rate (₹)</span>
                    <span>GST%</span>
                    <span>Amount (₹)</span>
                  </div>
                  {items.map((item, idx) => (
                    <div key={item.id} className="grid grid-cols-[2fr_1fr_auto_auto_auto_auto_auto_auto] gap-2 items-center">
                      <input value={item.description} onChange={e => updateItem(item.id, "description", e.target.value)}
                        placeholder={`Item ${idx + 1} description`}
                        className="px-2.5 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-orange-500" />
                      <input value={item.hsnCode || ""} onChange={e => updateItem(item.id, "hsnCode", e.target.value)}
                        placeholder="HSN" className="px-2.5 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-orange-500" />
                      <select value={item.unit || "nos"} onChange={e => updateItem(item.id, "unit", e.target.value)}
                        className="px-2 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-orange-500">
                        {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
                      </select>
                      <input type="number" min="0" value={item.quantity} onChange={e => updateItem(item.id, "quantity", parseFloat(e.target.value) || 0)}
                        className="w-16 px-2 py-2 border border-slate-200 rounded-lg text-sm text-right focus:outline-none focus:ring-1 focus:ring-orange-500" />
                      <input type="number" min="0" value={item.rate} onChange={e => updateItem(item.id, "rate", parseFloat(e.target.value) || 0)}
                        className="w-24 px-2 py-2 border border-slate-200 rounded-lg text-sm text-right focus:outline-none focus:ring-1 focus:ring-orange-500" />
                      <select value={item.gstRate ?? 18} onChange={e => updateItem(item.id, "gstRate", Number(e.target.value))}
                        className="px-2 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-orange-500">
                        {GST_RATES.map(r => <option key={r} value={r}>{r}%</option>)}
                      </select>
                      <div className="text-sm font-semibold text-slate-800 text-right min-w-[70px]">
                        ₹{fmtINR(item.quantity * item.rate)}
                      </div>
                      <button onClick={() => removeItem(item.id)} disabled={items.length === 1}
                        className="p-1.5 text-slate-300 hover:text-red-500 disabled:opacity-30 transition-colors">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              </section>

              {/* Totals preview */}
              <section className="bg-slate-50 rounded-xl p-4">
                <div className="text-xs font-bold text-slate-500 uppercase mb-3">Calculation Preview</div>
                <div className="space-y-1.5 text-sm">
                  <div className="flex justify-between text-slate-600">
                    <span>Subtotal</span><span className="font-medium">₹{fmtINR(totals.subtotal)}</span>
                  </div>
                  {totals.discountAmount > 0 && (
                    <div className="flex justify-between text-green-700">
                      <span>Discount</span><span>- ₹{fmtINR(totals.discountAmount)}</span>
                    </div>
                  )}
                  {totals.taxLines.map((tl, i) => (
                    gstType === "intra" ? (
                      <div key={i} className="space-y-1">
                        <div className="flex justify-between text-slate-600">
                          <span>CGST @ {tl.cgstRate}%</span><span>₹{fmtINR(tl.cgstAmount)}</span>
                        </div>
                        <div className="flex justify-between text-slate-600">
                          <span>SGST @ {tl.sgstRate}%</span><span>₹{fmtINR(tl.sgstAmount)}</span>
                        </div>
                      </div>
                    ) : (
                      <div key={i} className="flex justify-between text-slate-600">
                        <span>IGST @ {tl.igstRate}%</span><span>₹{fmtINR(tl.igstAmount)}</span>
                      </div>
                    )
                  ))}
                  {totals.addTotal > 0 && (
                    <div className="flex justify-between text-slate-600">
                      <span>Additional Charges</span><span>₹{fmtINR(totals.addTotal)}</span>
                    </div>
                  )}
                  {totals.tdsAmount > 0 && (
                    <div className="flex justify-between text-red-600">
                      <span>TDS ({tdsRate}%)</span><span>- ₹{fmtINR(totals.tdsAmount)}</span>
                    </div>
                  )}
                  {Math.abs(totals.roundOff) > 0.001 && (
                    <div className="flex justify-between text-slate-500">
                      <span>Round off</span><span>{totals.roundOff > 0 ? "+" : ""}₹{fmtINR(Math.abs(totals.roundOff))}</span>
                    </div>
                  )}
                  <div className="flex justify-between font-black text-base text-slate-900 border-t border-slate-200 pt-2 mt-2">
                    <span>Total</span><span>₹{fmtINR(totals.total)}</span>
                  </div>
                </div>
              </section>

              {/* Advanced section */}
              <section>
                <button onClick={() => setShowAdvanced(v => !v)}
                  className="flex items-center gap-2 text-sm font-semibold text-slate-600 hover:text-slate-900">
                  {showAdvanced ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  Advanced: Discount, TDS, Additional Charges, Terms
                </button>

                {showAdvanced && (
                  <div className="mt-4 space-y-5">
                    {/* Discount */}
                    <div>
                      <label className="block text-xs font-medium text-slate-600 mb-2">Discount</label>
                      <div className="flex gap-2">
                        <select value={discountType} onChange={e => setDiscountType(e.target.value)}
                          className="px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-500">
                          <option value="none">No discount</option>
                          <option value="pct">Percentage (%)</option>
                          <option value="fixed">Fixed amount (₹)</option>
                        </select>
                        {discountType !== "none" && (
                          <input type="number" min="0" value={discountValue} onChange={e => setDiscountValue(parseFloat(e.target.value) || 0)}
                            placeholder={discountType === "pct" ? "e.g. 5" : "e.g. 1000"}
                            className="flex-1 px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-500" />
                        )}
                      </div>
                    </div>

                    {/* GST type override */}
                    <div>
                      <label className="block text-xs font-medium text-slate-600 mb-2">GST Type</label>
                      <select value={gstTypeOverride} onChange={e => setGstTypeOverride(e.target.value as "auto" | "intra" | "inter")}
                        className="px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-500">
                        <option value="auto">Auto-detect from GSTIN</option>
                        <option value="intra">Intra-state (CGST + SGST)</option>
                        <option value="inter">Inter-state (IGST)</option>
                      </select>
                    </div>

                    {/* Additional charges */}
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <label className="text-xs font-medium text-slate-600">Additional Charges</label>
                        <button onClick={addCharge} className="text-xs font-semibold text-orange-600 hover:text-orange-700 flex items-center gap-1">
                          <Plus className="w-3 h-3" /> Add Charge
                        </button>
                      </div>
                      {additionalCharges.map(c => (
                        <div key={c.id} className="flex gap-2 mb-2">
                          <input value={c.label} onChange={e => setAdditionalCharges(prev => prev.map(x => x.id === c.id ? { ...x, label: e.target.value } : x))}
                            placeholder="e.g. Transport, Loading"
                            className="flex-1 px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-500" />
                          <input type="number" value={c.amount} onChange={e => setAdditionalCharges(prev => prev.map(x => x.id === c.id ? { ...x, amount: e.target.value } : x))}
                            placeholder="₹"
                            className="w-28 px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-500" />
                          <button onClick={() => setAdditionalCharges(prev => prev.filter(x => x.id !== c.id))} className="p-2 text-red-400 hover:text-red-600">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      ))}
                    </div>

                    {/* TDS */}
                    <div>
                      <label className="block text-xs font-medium text-slate-600 mb-2">TDS Rate (%)</label>
                      <input type="number" min="0" max="30" step="0.1" value={tdsRate} onChange={e => setTdsRate(parseFloat(e.target.value) || 0)}
                        placeholder="e.g. 2"
                        className="w-32 px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-500" />
                      {tdsRate > 0 && <p className="text-xs text-slate-500 mt-1">TDS = ₹{fmtINR(totals.tdsAmount)} will be deducted</p>}
                    </div>

                    {/* Terms */}
                    <div>
                      <label className="block text-xs font-medium text-slate-600 mb-1">Terms & Conditions</label>
                      <textarea value={terms} onChange={e => setTerms(e.target.value)} rows={3} placeholder="Payment terms, delivery terms..."
                        className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 resize-none" />
                    </div>

                    {/* Notes */}
                    <div>
                      <label className="block text-xs font-medium text-slate-600 mb-1">Notes</label>
                      <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} placeholder="Internal or external notes..."
                        className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 resize-none" />
                    </div>

                    {/* Payment instructions */}
                    <div>
                      <label className="block text-xs font-medium text-slate-600 mb-1">Payment Instructions</label>
                      <textarea value={paymentInstructions} onChange={e => setPaymentInstructions(e.target.value)} rows={2}
                        placeholder="Please transfer to bank account / UPI..."
                        className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 resize-none" />
                    </div>
                  </div>
                )}
              </section>
            </div>

            <div className="flex gap-3 p-5 border-t border-slate-100 sticky bottom-0 bg-white rounded-b-2xl">
              <button onClick={() => { setShowModal(false); resetForm(); }}
                className="flex-1 py-2.5 border border-slate-200 rounded-xl text-slate-600 text-sm font-medium hover:bg-slate-50">
                Cancel
              </button>
              <button onClick={handleCreate} disabled={saving || !clientName.trim()}
                className="flex-1 py-2.5 bg-orange-500 hover:bg-orange-600 text-white rounded-xl text-sm font-semibold disabled:opacity-60">
                {saving ? <><Loader2 className="w-4 h-4 animate-spin inline mr-2" />Creating...</> : "Create Invoice"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Record Payment Modal ─── */}
      {paymentInvoice && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
            <div className="flex items-center justify-between p-5 border-b border-slate-100">
              <div>
                <h2 className="font-bold text-slate-900">Record Payment</h2>
                <p className="text-sm text-slate-500">Invoice {paymentInvoice.invoiceNumber}</p>
              </div>
              <button onClick={() => { setPaymentInvoice(null); setPaymentError(""); }} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-5 space-y-4">
              {paymentError && <p className="text-red-600 text-sm bg-red-50 rounded-lg p-3">{paymentError}</p>}
              <div className="bg-slate-50 rounded-xl p-3 text-sm">
                <span className="text-slate-500">Balance Due: </span>
                <span className="font-bold text-lg text-slate-900">{fmtINR(paymentInvoice.balanceAmount)}</span>
              </div>
              {[
                { label: "Amount (₹)", key: "amount", type: "number" },
                { label: "Payment Date", key: "date", type: "date" },
                { label: "Reference", key: "reference", type: "text", placeholder: "Transaction ID" },
                { label: "Notes", key: "notes", type: "text", placeholder: "Optional" },
              ].map(f => (
                <div key={f.key}>
                  <label className="block text-sm font-medium text-slate-700 mb-1">{f.label}</label>
                  <input type={f.type} placeholder={f.placeholder || ""} value={paymentForm[f.key as keyof typeof paymentForm]}
                    onChange={e => setPaymentForm(prev => ({ ...prev, [f.key]: e.target.value }))}
                    className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-500" />
                </div>
              ))}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Payment Mode</label>
                <select value={paymentForm.mode} onChange={e => setPaymentForm(prev => ({ ...prev, mode: e.target.value }))}
                  className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-500">
                  {["bank", "cash", "upi", "cheque", "razorpay"].map(m => (
                    <option key={m} value={m}>{m.charAt(0).toUpperCase() + m.slice(1)}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="flex gap-3 p-5 border-t border-slate-100">
              <button onClick={() => { setPaymentInvoice(null); setPaymentError(""); }}
                className="flex-1 py-2.5 border border-slate-200 rounded-xl text-sm text-slate-600 hover:bg-slate-50">Cancel</button>
              <button onClick={submitPayment} disabled={paymentSaving || !paymentForm.amount || !paymentForm.date}
                className="flex-1 py-2.5 bg-green-500 hover:bg-green-600 text-white rounded-xl text-sm font-semibold disabled:opacity-60">
                {paymentSaving ? "Saving..." : "Save Payment"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
