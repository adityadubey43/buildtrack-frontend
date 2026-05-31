"use client";

import { useState, useEffect } from "react";
import { Calculator, CheckCircle, Clock, Users, DollarSign, Loader2 } from "lucide-react";
import { api, type Payroll } from "@/lib/api";

function fmt(n: number) { return `₹${n.toLocaleString("en-IN")}`; }

export default function PayrollPage() {
  const [payrolls, setPayrolls] = useState<Payroll[]>([]);
  const [loading, setLoading]   = useState(true);
  const [paying, setPaying]     = useState<string | null>(null);

  useEffect(() => {
    api.payroll.list()
      .then(r => setPayrolls(r.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const totalPaid    = payrolls.reduce((s, p) => s + p.paidAmount, 0);
  const totalPending = payrolls.reduce((s, p) => s + p.pendingAmount, 0);

  const handlePay = async (id: string) => {
    setPaying(id);
    try {
      const res = await api.payroll.pay(id, { payAll: true, paymentMode: "cash" });
      setPayrolls(prev => prev.map(p => p._id === id ? res.data : p));
    } catch (err) { console.error(err); }
    finally { setPaying(null); }
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
          <h1 className="text-2xl font-bold text-slate-900">Payroll</h1>
          <p className="text-slate-500 text-sm">Manage worker payments</p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-white border border-slate-100 rounded-2xl p-4 shadow-sm">
          <div className="flex items-center gap-2 mb-2"><Users className="w-4 h-4 text-slate-400" /></div>
          <div className="text-xl font-black text-slate-900">{payrolls.length}</div>
          <div className="text-xs text-slate-500">Payroll Cycles</div>
        </div>
        <div className="bg-green-50 border border-green-100 rounded-2xl p-4">
          <div className="flex items-center gap-2 mb-2"><CheckCircle className="w-4 h-4 text-green-500" /></div>
          <div className="text-xl font-black text-green-700">{fmt(totalPaid)}</div>
          <div className="text-xs text-green-600">Total Paid</div>
        </div>
        <div className="bg-orange-50 border border-orange-100 rounded-2xl p-4">
          <div className="flex items-center gap-2 mb-2"><Clock className="w-4 h-4 text-orange-500" /></div>
          <div className="text-xl font-black text-orange-700">{fmt(totalPending)}</div>
          <div className="text-xs text-orange-600">Pending</div>
        </div>
      </div>

      {payrolls.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-12 text-center">
          <Calculator className="w-10 h-10 text-slate-300 mx-auto mb-3" />
          <p className="text-slate-500 font-medium">No payroll records yet</p>
          <p className="text-slate-400 text-sm mt-1">Payroll is calculated from attendance records. Mark attendance first.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {payrolls.map(p => (
            <div key={p._id} className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <p className="font-bold text-slate-900 capitalize">{p.workerType} Payroll — {p.weekLabel || p.cycle}</p>
                  <p className="text-sm text-slate-500">{p.project?.name || "All Sites"} · {p.entries.length} workers</p>
                </div>
                <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${p.status === "paid" ? "bg-green-100 text-green-700" : "bg-orange-100 text-orange-700"}`}>
                  {p.status === "paid" ? "Paid" : "Pending"}
                </span>
              </div>

              <div className="grid grid-cols-3 gap-3 mb-4">
                <div className="text-center p-3 bg-slate-50 rounded-xl">
                  <p className="text-xs text-slate-500 mb-0.5">Total</p>
                  <p className="font-bold text-slate-900">{fmt(p.totalAmount)}</p>
                </div>
                <div className="text-center p-3 bg-green-50 rounded-xl">
                  <p className="text-xs text-green-600 mb-0.5">Paid</p>
                  <p className="font-bold text-green-700">{fmt(p.paidAmount)}</p>
                </div>
                <div className="text-center p-3 bg-orange-50 rounded-xl">
                  <p className="text-xs text-orange-600 mb-0.5">Pending</p>
                  <p className="font-bold text-orange-700">{fmt(p.pendingAmount)}</p>
                </div>
              </div>

              {/* Entries */}
              {p.entries.length > 0 && (
                <div className="border border-slate-100 rounded-xl overflow-hidden">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-slate-50">
                        <th className="text-left px-3 py-2 text-xs font-semibold text-slate-500">Worker</th>
                        <th className="text-left px-3 py-2 text-xs font-semibold text-slate-500">Days</th>
                        <th className="text-left px-3 py-2 text-xs font-semibold text-slate-500">Amount</th>
                        <th className="text-left px-3 py-2 text-xs font-semibold text-slate-500">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {p.entries.map(e => (
                        <tr key={e._id} className="hover:bg-slate-50">
                          <td className="px-3 py-2 font-medium text-slate-800">{e.worker.name}</td>
                          <td className="px-3 py-2 text-slate-600">{e.daysWorked}</td>
                          <td className="px-3 py-2 font-semibold text-slate-900">{fmt(e.totalAmount)}</td>
                          <td className="px-3 py-2">
                            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${e.status === "paid" ? "bg-green-100 text-green-700" : "bg-orange-100 text-orange-700"}`}>
                              {e.status === "paid" ? "Paid" : "Pending"}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {p.pendingAmount > 0 && (
                <button onClick={() => handlePay(p._id)} disabled={paying === p._id}
                  className="mt-3 w-full py-2.5 bg-orange-500 hover:bg-orange-600 text-white rounded-xl text-sm font-semibold disabled:opacity-60 flex items-center justify-center gap-2">
                  {paying === p._id ? <><Loader2 className="w-4 h-4 animate-spin" />Processing...</> : <><DollarSign className="w-4 h-4" />Pay {fmt(p.pendingAmount)}</>}
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
