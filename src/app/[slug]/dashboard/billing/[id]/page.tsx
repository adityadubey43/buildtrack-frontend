"use client";

import { useState, useEffect, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { Loader2, ArrowLeft, Printer, Share2, MessageCircle, Mail, Copy, CheckCircle, AlertCircle, Clock, FileText, X } from "lucide-react";
import { api, type Invoice } from "@/lib/api";

function fmtINR(n: number) {
  return n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtDate(d?: string) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

const WORK_TYPE_LABELS: Record<string, string> = {
  labour: "Labour Work", material: "Material Supply", turnkey: "Turnkey",
  pmc: "Project Management", supply: "Supply", other: "Construction Work",
};

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: React.ComponentType<{ className?: string }> }> = {
  draft:           { label: "Draft",           color: "bg-slate-100 text-slate-600", icon: FileText },
  sent:            { label: "Sent",            color: "bg-blue-100 text-blue-700",   icon: Clock },
  "partially-paid":{ label: "Partial",         color: "bg-yellow-100 text-yellow-700", icon: Clock },
  paid:            { label: "Paid",            color: "bg-green-100 text-green-700", icon: CheckCircle },
  overdue:         { label: "Overdue",         color: "bg-red-100 text-red-700",     icon: AlertCircle },
  cancelled:       { label: "Cancelled",       color: "bg-slate-100 text-slate-500", icon: X },
};

export default function InvoicePage() {
  const params = useParams();
  const router = useRouter();
  const slug = params.slug as string;
  const id = params.id as string;

  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [showPayment, setShowPayment] = useState(false);
  const [paymentForm, setPaymentForm] = useState({ amount: "", date: "", mode: "bank", reference: "", notes: "" });
  const [paymentSaving, setPaymentSaving] = useState(false);
  const [paymentError, setPaymentError] = useState("");
  const printRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    api.invoices.print(id)
      .then(r => setInvoice(r.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [id]);

  const handlePrint = () => window.print();

  const handleCopyLink = async () => {
    await navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleWhatsApp = () => {
    if (!invoice) return;
    const msg = `Invoice ${invoice.invoiceNumber} from ${invoice.company?.name || ""}\nClient: ${invoice.client?.name || invoice.clientName}\nAmount: ₹${fmtINR(invoice.totalAmount)}\nStatus: ${invoice.status}\n\nView: ${window.location.href}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, "_blank");
  };

  const handleEmail = () => {
    if (!invoice) return;
    const subject = `Invoice ${invoice.invoiceNumber} - ₹${fmtINR(invoice.totalAmount)}`;
    const body = `Dear ${invoice.client?.name || "Client"},\n\nPlease find attached invoice ${invoice.invoiceNumber} for ₹${fmtINR(invoice.totalAmount)}.\n\nRegards,\n${invoice.company?.name || ""}`;
    window.location.href = `mailto:${invoice.client?.email || ""}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  };

  const submitPayment = async () => {
    if (!invoice || !paymentForm.amount || !paymentForm.date) return;
    setPaymentSaving(true);
    setPaymentError("");
    try {
      const r = await api.invoices.recordPayment(id, {
        amount: parseFloat(paymentForm.amount),
        date: paymentForm.date,
        mode: paymentForm.mode,
        reference: paymentForm.reference,
        notes: paymentForm.notes,
      });
      setInvoice(r.data);
      setShowPayment(false);
      setPaymentForm({ amount: "", date: "", mode: "bank", reference: "", notes: "" });
    } catch (e) {
      setPaymentError(e instanceof Error ? e.message : "Payment failed");
    } finally {
      setPaymentSaving(false);
    }
  };

  if (loading) return (
    <div className="flex items-center justify-center min-h-screen">
      <Loader2 className="w-8 h-8 animate-spin text-orange-500" />
    </div>
  );

  if (!invoice) return (
    <div className="flex items-center justify-center min-h-screen text-slate-500">Invoice not found</div>
  );

  const sc = STATUS_CONFIG[invoice.status] || STATUS_CONFIG.draft;
  const clientName = invoice.client?.name || invoice.clientName || "—";
  const isIntra = invoice.gstType === "intra" || !invoice.gstType;

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Action bar — hidden on print */}
      <div className="print:hidden bg-white border-b border-slate-200 px-6 py-3 flex items-center justify-between sticky top-0 z-10">
        <button onClick={() => router.push(`/${slug}/dashboard/billing`)}
          className="flex items-center gap-2 text-slate-600 hover:text-slate-900 text-sm font-medium">
          <ArrowLeft className="w-4 h-4" /> Back to Invoices
        </button>
        <div className="flex items-center gap-2">
          {invoice.status !== "paid" && (
            <button onClick={() => { setShowPayment(true); setPaymentForm(f => ({ ...f, amount: String(invoice.balanceAmount), date: new Date().toISOString().split("T")[0] })); }}
              className="px-3 py-1.5 bg-green-500 hover:bg-green-600 text-white rounded-lg text-sm font-medium">
              Record Payment
            </button>
          )}
          <button onClick={handleWhatsApp} title="Share on WhatsApp"
            className="p-2 text-slate-500 hover:text-green-600 hover:bg-green-50 rounded-lg transition-colors">
            <MessageCircle className="w-5 h-5" />
          </button>
          <button onClick={handleEmail} title="Share via Email"
            className="p-2 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors">
            <Mail className="w-5 h-5" />
          </button>
          <button onClick={handleCopyLink} title="Copy link"
            className="p-2 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors">
            {copied ? <CheckCircle className="w-5 h-5 text-green-600" /> : <Copy className="w-5 h-5" />}
          </button>
          <button onClick={handlePrint}
            className="flex items-center gap-2 px-3 py-1.5 bg-orange-500 hover:bg-orange-600 text-white rounded-lg text-sm font-medium">
            <Printer className="w-4 h-4" /> Download PDF
          </button>
        </div>
      </div>

      {/* Invoice document */}
      <div className="max-w-4xl mx-auto p-6 print:p-0 print:max-w-none" ref={printRef}>
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 print:shadow-none print:border-none print:rounded-none" id="invoice-print">

          {/* Header */}
          <div className="p-8 border-b-4 border-orange-500 print:border-orange-600">
            <div className="flex justify-between items-start">
              <div className="flex-1">
                {invoice.company?.logo && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={invoice.company.logo} alt="Company Logo" className="h-16 object-contain mb-3" />
                )}
                <h1 className="text-2xl font-black text-slate-900">{invoice.company?.name || "—"}</h1>
                {invoice.company?.address && <p className="text-sm text-slate-600 mt-1 whitespace-pre-line">{invoice.company.address}</p>}
                {invoice.company?.phone && <p className="text-sm text-slate-600">Ph: {invoice.company.phone}</p>}
                {invoice.company?.email && <p className="text-sm text-slate-600">{invoice.company.email}</p>}
                {invoice.company?.gstin && <p className="text-sm font-semibold text-slate-700 mt-1">GSTIN: {invoice.company.gstin}</p>}
                {invoice.company?.pan && <p className="text-sm text-slate-600">PAN: {invoice.company.pan}</p>}
              </div>
              <div className="text-right">
                <div className="text-3xl font-black text-orange-500 tracking-tight">TAX INVOICE</div>
                <div className="mt-3 space-y-1">
                  <div className="flex justify-end gap-3 text-sm">
                    <span className="text-slate-500">Invoice #</span>
                    <span className="font-bold text-slate-900 font-mono">{invoice.invoiceNumber}</span>
                  </div>
                  <div className="flex justify-end gap-3 text-sm">
                    <span className="text-slate-500">Invoice Date</span>
                    <span className="font-medium text-slate-800">{fmtDate(invoice.invoiceDate)}</span>
                  </div>
                  {invoice.dueDate && (
                    <div className="flex justify-end gap-3 text-sm">
                      <span className="text-slate-500">Due Date</span>
                      <span className={`font-medium ${invoice.status === "overdue" ? "text-red-600 font-bold" : "text-slate-800"}`}>
                        {fmtDate(invoice.dueDate)}
                      </span>
                    </div>
                  )}
                  <div className="flex justify-end gap-2 mt-2">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${sc.color}`}>{sc.label}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Bill to / Work details */}
          <div className="px-8 py-6 grid grid-cols-2 gap-8 border-b border-slate-100">
            <div>
              <div className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Bill To</div>
              <div className="font-bold text-slate-900 text-lg">{clientName}</div>
              {invoice.client?.address && <p className="text-sm text-slate-600 mt-1 whitespace-pre-line">{invoice.client.address}</p>}
              {invoice.client?.gstin && <p className="text-sm font-semibold text-slate-700 mt-1">GSTIN: {invoice.client.gstin}</p>}
              {invoice.client?.phone && <p className="text-sm text-slate-600">Ph: {invoice.client.phone}</p>}
              {invoice.client?.email && <p className="text-sm text-slate-600">{invoice.client.email}</p>}
            </div>
            <div>
              <div className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Project Details</div>
              <div className="space-y-1 text-sm">
                {(invoice.projectName || invoice.project?.name) && (
                  <div className="flex gap-2">
                    <span className="text-slate-500 w-20">Project</span>
                    <span className="font-medium text-slate-800">{invoice.projectName || invoice.project?.name}</span>
                  </div>
                )}
                {invoice.siteName && (
                  <div className="flex gap-2">
                    <span className="text-slate-500 w-20">Site</span>
                    <span className="font-medium text-slate-800">{invoice.siteName}</span>
                  </div>
                )}
                {invoice.siteLocation && (
                  <div className="flex gap-2">
                    <span className="text-slate-500 w-20">Location</span>
                    <span className="font-medium text-slate-800">{invoice.siteLocation}</span>
                  </div>
                )}
                {invoice.workType && (
                  <div className="flex gap-2">
                    <span className="text-slate-500 w-20">Work Type</span>
                    <span className="font-medium text-slate-800">{WORK_TYPE_LABELS[invoice.workType] || invoice.workType}</span>
                  </div>
                )}
                {invoice.recurring?.milestone && (
                  <div className="flex gap-2">
                    <span className="text-slate-500 w-20">Milestone</span>
                    <span className="font-medium text-slate-800">{invoice.recurring.milestone}</span>
                  </div>
                )}
                {invoice.reverseCharge && (
                  <div className="mt-2 text-xs font-bold text-orange-600 bg-orange-50 px-2 py-1 rounded">
                    Reverse Charge Applicable
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Line items */}
          <div className="px-8 py-4">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-orange-50 text-orange-800">
                  <th className="text-left py-2 px-3 font-semibold rounded-l-lg">#</th>
                  <th className="text-left py-2 px-3 font-semibold">Description</th>
                  <th className="text-left py-2 px-3 font-semibold">HSN</th>
                  <th className="text-center py-2 px-3 font-semibold">Unit</th>
                  <th className="text-right py-2 px-3 font-semibold">Qty</th>
                  <th className="text-right py-2 px-3 font-semibold">Rate (₹)</th>
                  <th className="text-right py-2 px-3 font-semibold">GST%</th>
                  <th className="text-right py-2 px-3 font-semibold rounded-r-lg">Amount (₹)</th>
                </tr>
              </thead>
              <tbody>
                {invoice.items.map((item, i) => (
                  <tr key={i} className="border-b border-slate-50">
                    <td className="py-3 px-3 text-slate-500">{i + 1}</td>
                    <td className="py-3 px-3 font-medium text-slate-900">{item.description}</td>
                    <td className="py-3 px-3 text-slate-500">{item.hsnCode || "—"}</td>
                    <td className="py-3 px-3 text-center text-slate-600">{item.unit || "nos"}</td>
                    <td className="py-3 px-3 text-right text-slate-700">{item.quantity}</td>
                    <td className="py-3 px-3 text-right text-slate-700">{fmtINR(item.rate)}</td>
                    <td className="py-3 px-3 text-right text-slate-600">{item.gstRate ?? 18}%</td>
                    <td className="py-3 px-3 text-right font-semibold text-slate-900">{fmtINR(item.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Totals */}
          <div className="px-8 pb-8">
            <div className="flex justify-end">
              <div className="w-80 space-y-2 text-sm">
                <div className="flex justify-between text-slate-600">
                  <span>Subtotal</span>
                  <span className="font-medium">₹{fmtINR(invoice.subtotal)}</span>
                </div>

                {invoice.discountAmount != null && invoice.discountAmount > 0 && (
                  <div className="flex justify-between text-green-700">
                    <span>Discount {invoice.discountType === "pct" ? `(${invoice.discountValue}%)` : ""}</span>
                    <span className="font-medium">- ₹{fmtINR(invoice.discountAmount)}</span>
                  </div>
                )}

                {invoice.taxableAmount != null && invoice.discountAmount != null && invoice.discountAmount > 0 && (
                  <div className="flex justify-between text-slate-600 border-t border-slate-100 pt-2">
                    <span>Taxable Amount</span>
                    <span className="font-medium">₹{fmtINR(invoice.taxableAmount)}</span>
                  </div>
                )}

                {/* Tax lines */}
                {invoice.taxLines && invoice.taxLines.length > 0 ? (
                  invoice.taxLines.map((tl, i) => (
                    <div key={i} className="space-y-1">
                      {isIntra ? (
                        <>
                          <div className="flex justify-between text-slate-600">
                            <span>CGST @ {tl.cgstRate}%</span>
                            <span>₹{fmtINR(tl.cgstAmount ?? 0)}</span>
                          </div>
                          <div className="flex justify-between text-slate-600">
                            <span>SGST @ {tl.sgstRate}%</span>
                            <span>₹{fmtINR(tl.sgstAmount ?? 0)}</span>
                          </div>
                        </>
                      ) : (
                        <div className="flex justify-between text-slate-600">
                          <span>IGST @ {tl.igstRate}%</span>
                          <span>₹{fmtINR(tl.igstAmount ?? 0)}</span>
                        </div>
                      )}
                    </div>
                  ))
                ) : (
                  // Backward compat: old invoices with gstAmount
                  invoice.gstAmount != null && invoice.gstAmount > 0 && (
                    <div className="flex justify-between text-slate-600">
                      <span>GST ({invoice.gstRate ?? 18}%)</span>
                      <span>₹{fmtINR(invoice.gstAmount)}</span>
                    </div>
                  )
                )}

                {invoice.additionalCharges?.map((c, i) => (
                  <div key={i} className="flex justify-between text-slate-600">
                    <span>{c.label}</span>
                    <span>₹{fmtINR(c.amount)}</span>
                  </div>
                ))}

                {invoice.tdsAmount != null && invoice.tdsAmount > 0 && (
                  <div className="flex justify-between text-red-600">
                    <span>TDS ({invoice.tdsRate}%)</span>
                    <span>- ₹{fmtINR(invoice.tdsAmount)}</span>
                  </div>
                )}

                {invoice.roundOff != null && Math.abs(invoice.roundOff) > 0.001 && (
                  <div className="flex justify-between text-slate-500">
                    <span>Round off</span>
                    <span>{invoice.roundOff > 0 ? "+" : ""}₹{fmtINR(Math.abs(invoice.roundOff))}</span>
                  </div>
                )}

                <div className="flex justify-between font-black text-lg text-slate-900 border-t-2 border-slate-900 pt-2 mt-2">
                  <span>Total</span>
                  <span>₹{fmtINR(invoice.totalAmount)}</span>
                </div>

                {invoice.paidAmount > 0 && (
                  <>
                    <div className="flex justify-between text-green-700 font-medium">
                      <span>Paid</span>
                      <span>₹{fmtINR(invoice.paidAmount)}</span>
                    </div>
                    <div className="flex justify-between font-bold text-orange-600 border-t border-orange-200 pt-1">
                      <span>Balance Due</span>
                      <span>₹{fmtINR(invoice.balanceAmount)}</span>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Payment & Bank details */}
          {(invoice.company?.upiId || invoice.company?.bankName || invoice.paymentInstructions) && (
            <div className="mx-8 mb-6 p-5 bg-blue-50 rounded-xl border border-blue-100">
              <div className="text-xs font-bold text-blue-800 uppercase tracking-widest mb-3">Payment Details</div>
              <div className="grid grid-cols-2 gap-4 text-sm">
                {(invoice.company?.bankName || invoice.company?.accountNumber) && (
                  <div className="space-y-1">
                    {invoice.company?.bankName && <div><span className="text-slate-500">Bank: </span><span className="font-medium">{invoice.company.bankName}</span></div>}
                    {invoice.company?.accountHolder && <div><span className="text-slate-500">Account: </span><span className="font-medium">{invoice.company.accountHolder}</span></div>}
                    {invoice.company?.accountNumber && <div><span className="text-slate-500">A/c No: </span><span className="font-medium font-mono">{invoice.company.accountNumber}</span></div>}
                    {invoice.company?.ifsc && <div><span className="text-slate-500">IFSC: </span><span className="font-medium font-mono">{invoice.company.ifsc}</span></div>}
                  </div>
                )}
                {invoice.company?.upiId && (
                  <div>
                    <div className="text-slate-500">UPI ID</div>
                    <div className="font-bold text-blue-700 text-lg">{invoice.company.upiId}</div>
                  </div>
                )}
              </div>
              {invoice.paymentInstructions && (
                <p className="mt-3 text-sm text-slate-600 whitespace-pre-line">{invoice.paymentInstructions}</p>
              )}
            </div>
          )}

          {/* Terms & Notes */}
          {(invoice.terms || invoice.notes) && (
            <div className="px-8 pb-6 grid grid-cols-2 gap-6">
              {invoice.terms && (
                <div>
                  <div className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Terms & Conditions</div>
                  <p className="text-sm text-slate-600 whitespace-pre-line">{invoice.terms}</p>
                </div>
              )}
              {invoice.notes && (
                <div>
                  <div className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Notes</div>
                  <p className="text-sm text-slate-600 whitespace-pre-line">{invoice.notes}</p>
                </div>
              )}
            </div>
          )}

          {/* Signature */}
          {invoice.company?.signature && (
            <div className="px-8 pb-8 flex justify-end">
              <div className="text-center">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={invoice.company.signature} alt="Signature" className="h-16 object-contain mb-1" />
                <div className="text-xs text-slate-500 border-t border-slate-300 pt-1 px-8">Authorised Signatory</div>
                <div className="text-sm font-medium text-slate-700">{invoice.company.name}</div>
              </div>
            </div>
          )}

          {/* Payment history */}
          {invoice.payments && invoice.payments.length > 0 && (
            <div className="px-8 pb-8 print:hidden">
              <div className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">Payment History</div>
              <div className="space-y-2">
                {invoice.payments.map((p, i) => (
                  <div key={i} className="flex justify-between items-center text-sm bg-green-50 rounded-lg px-4 py-2">
                    <div>
                      <span className="font-medium text-slate-800">{fmtDate(p.date)}</span>
                      <span className="text-slate-500 ml-2">via {p.mode}</span>
                      {p.reference && <span className="text-slate-500 ml-2">· Ref: {p.reference}</span>}
                    </div>
                    <span className="font-bold text-green-700">₹{fmtINR(p.amount)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Footer */}
          <div className="px-8 py-4 bg-orange-500 rounded-b-2xl print:rounded-none text-white text-center text-xs">
            Thank you for your business! · {invoice.company?.name || ""}
            {invoice.company?.phone && ` · ${invoice.company.phone}`}
          </div>
        </div>
      </div>

      {/* Record Payment Modal */}
      {showPayment && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 print:hidden">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
            <div className="flex items-center justify-between p-5 border-b border-slate-100">
              <h2 className="font-bold text-slate-900">Record Payment</h2>
              <button onClick={() => setShowPayment(false)} className="text-slate-400 hover:text-slate-600"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-5 space-y-4">
              {paymentError && <p className="text-red-600 text-sm bg-red-50 rounded-lg p-3">{paymentError}</p>}
              <div className="bg-slate-50 rounded-xl p-3 text-sm">
                <span className="text-slate-500">Balance Due: </span>
                <span className="font-bold text-lg text-slate-900">₹{fmtINR(invoice.balanceAmount)}</span>
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
                <label className="block text-sm font-medium text-slate-700 mb-1">Mode</label>
                <select value={paymentForm.mode} onChange={e => setPaymentForm(prev => ({ ...prev, mode: e.target.value }))}
                  className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-500">
                  {["bank", "cash", "upi", "cheque", "razorpay"].map(m => <option key={m} value={m}>{m.charAt(0).toUpperCase() + m.slice(1)}</option>)}
                </select>
              </div>
            </div>
            <div className="flex gap-3 p-5 border-t border-slate-100">
              <button onClick={() => setShowPayment(false)} className="flex-1 py-2.5 border border-slate-200 rounded-xl text-sm text-slate-600 hover:bg-slate-50">Cancel</button>
              <button onClick={submitPayment} disabled={paymentSaving || !paymentForm.amount || !paymentForm.date}
                className="flex-1 py-2.5 bg-green-500 hover:bg-green-600 text-white rounded-xl text-sm font-semibold disabled:opacity-60">
                {paymentSaving ? "Saving..." : "Save Payment"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Print CSS */}
      <style jsx global>{`
        @media print {
          body > * { display: none !important; }
          body > #__next { display: block !important; }
          .print\\:hidden { display: none !important; }
          nav, aside, header { display: none !important; }
          #invoice-print { display: block !important; }
          @page { margin: 0.5in; }
        }
      `}</style>
    </div>
  );
}
