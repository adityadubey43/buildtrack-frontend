"use client";

import { useState, useEffect, useCallback } from "react";
import { Calculator, CheckCircle, Clock, Users, DollarSign, Loader2, Wallet, ArrowRight, LayoutGrid } from "lucide-react";
import { api, type Payroll, type Project, type PayrollEntry } from "@/lib/api";

function fmt(n: number) { return `₹${n.toLocaleString("en-IN")}`; }
function todayStr() { return new Date().toISOString().split("T")[0]; }
function startOfWeek() {
  const d = new Date();
  const day = d.getDay();
  const diff = (day === 0 ? -6 : 1) - day;
  d.setDate(d.getDate() + diff);
  return d.toISOString().split("T")[0];
}

export default function PayrollPage() {
  const [payrolls, setPayrolls] = useState<Payroll[]>([]);
  const [loading, setLoading]   = useState(true);
  const [paying, setPaying]     = useState<string | null>(null);
  const [calculating, setCalculating] = useState(false);
  const [workerType, setWorkerType] = useState<"labour" | "employee">("employee");
  const [projects, setProjects] = useState<Project[]>([]);
  const [payModalOpen, setPayModalOpen] = useState(false);
  const [selectedPayrollId, setSelectedPayrollId] = useState<string | null>(null);
  const [selectedEntry, setSelectedEntry] = useState<PayrollEntry | null>(null);
  const [payOption, setPayOption] = useState<"site" | "split">("site");
  const [selectedProjectId, setSelectedProjectId] = useState("");
  const [payProcessing, setPayProcessing] = useState(false);

  const loadPayrolls = useCallback(async () => {
    try {
      const res = await api.payroll.list();
      setPayrolls(res.data);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadProjects = useCallback(async () => {
    try {
      const res = await api.projects.list({ status: "active", limit: "200" });
      setProjects(res.data);
    } catch (error) {
      console.error(error);
    }
  }, []);

  useEffect(() => {
    loadPayrolls();
    loadProjects();
  }, [loadPayrolls, loadProjects]);

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

  const handlePayrollCalculate = async () => {
    setCalculating(true);
    try {
      await api.payroll.calculate({ workerType, startDate: startOfWeek(), endDate: todayStr(), cycle: workerType === "employee" ? "monthly" : "weekly" });
      const res = await api.payroll.list();
      setPayrolls(res.data);
    } catch (err: unknown) {
      console.error(err);
      const message = err instanceof Error ? err.message : "Failed to calculate payroll.";
      alert(`Failed to calculate payroll. ${message}`);
    } finally {
      setCalculating(false);
    }
  };

  const openPayEntryModal = (payrollId: string, entry: PayrollEntry) => {
    setSelectedPayrollId(payrollId);
    setSelectedEntry(entry);
    setSelectedProjectId(entry.project?._id || entry.projectBreakdown?.[0]?.project?._id || "");
    setPayOption(entry.projectBreakdown && entry.projectBreakdown.length > 1 ? "split" : "site");
    setPayModalOpen(true);
  };

  const closePayEntryModal = () => {
    setPayModalOpen(false);
    setSelectedEntry(null);
    setSelectedPayrollId(null);
    setSelectedProjectId("");
    setPayOption("site");
  };

  const calculateEntrySplit = (entry: PayrollEntry) => {
    if (!entry.projectBreakdown || entry.projectBreakdown.length === 0) return [];
    const count = entry.projectBreakdown.length;
    const base = Math.floor(entry.totalAmount / count);
    let remainder = entry.totalAmount - base * count;
    return entry.projectBreakdown.map((item) => {
      const value = base + (remainder > 0 ? 1 : 0);
      remainder -= 1;
      return { project: item.project, amount: value };
    });
  };

  const handlePayEntry = async () => {
    if (!selectedEntry) return;
    setPayProcessing(true);
    try {
      const expensesToCreate: Array<{ project: string; amount: number }> = [];
      if (payOption === "split" && selectedEntry.projectBreakdown && selectedEntry.projectBreakdown.length > 1) {
        const splits = calculateEntrySplit(selectedEntry);
        splits.forEach((split) => {
          if (split.project?._id) {
            expensesToCreate.push({ project: split.project._id, amount: split.amount });
          }
        });
      } else {
        const projectId = selectedProjectId || selectedEntry.project?._id || selectedEntry.projectBreakdown?.[0]?.project?._id;
        if (!projectId) {
          alert("Please select a site before marking payroll as paid.");
          return;
        }
        expensesToCreate.push({ project: projectId, amount: selectedEntry.totalAmount });
      }

      for (const expense of expensesToCreate) {
        await api.expenses.create({
          project: expense.project,
          type: "labour",
          description: `Payroll payment for ${selectedEntry.worker.name}`,
          amount: expense.amount,
          paymentMode: "bank",
          date: todayStr(),
        });
      }

      if (!selectedPayrollId) throw new Error("Payroll record is missing.");
      const res = await api.payroll.pay(selectedPayrollId, { entryId: selectedEntry._id, paymentMode: "bank" });
      setPayrolls(prev => prev.map(p => p._id === res.data._id ? res.data : p));
      setPayModalOpen(false);
      setSelectedEntry(null);
    } catch (err: unknown) {
      console.error(err);
      const message = err instanceof Error ? err.message : "Failed to pay payroll entry.";
      alert(message);
    } finally {
      setPayProcessing(false);
    }
  };

  if (loading) return (
    <div className="p-6 flex items-center justify-center min-h-64">
      <Loader2 className="w-6 h-6 animate-spin text-orange-500" />
    </div>
  );

  return (
    <div className="p-4 lg:p-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Payroll</h1>
          <p className="text-slate-500 text-sm">Manage worker payments</p>
        </div>
        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
          <div className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 py-2">
            <LayoutGrid className="w-4 h-4 text-slate-500" />
            <select
              value={workerType}
              onChange={(e) => setWorkerType(e.target.value as "labour" | "employee")}
              className="bg-transparent text-sm text-slate-700 outline-none"
            >
              <option value="employee">Employee</option>
              <option value="labour">Labour</option>
            </select>
          </div>
          <button
            type="button"
            onClick={handlePayrollCalculate}
            disabled={calculating}
            className="inline-flex items-center justify-center gap-2 rounded-2xl bg-orange-500 px-4 py-2.5 text-sm font-semibold text-white hover:bg-orange-600 disabled:opacity-60"
          >
            {calculating ? <><Loader2 className="w-4 h-4 animate-spin" />Calculating...</> : <><Calculator className="w-4 h-4" />Calculate payroll</>}
          </button>
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
                        <th className="text-left px-3 py-2 text-xs font-semibold text-slate-500">Action</th>
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
                          <td className="px-3 py-2">
                            {e.status === "pending" ? (
                              <button
                                type="button"
                                onClick={() => openPayEntryModal(p._id, e)}
                                className="rounded-full bg-orange-500 px-3 py-1 text-xs font-semibold text-white hover:bg-orange-600"
                              >
                                Pay
                              </button>
                            ) : (
                              <span className="text-xs text-slate-500">—</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

            </div>
          ))}
        </div>
      )}

      {payModalOpen && selectedEntry && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-2xl overflow-hidden rounded-3xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
              <div>
                <p className="text-sm text-slate-500">Pay payroll entry</p>
                <h2 className="text-xl font-semibold text-slate-900">{selectedEntry.worker.name}</h2>
              </div>
              <button
                type="button"
                onClick={closePayEntryModal}
                className="rounded-full bg-slate-100 p-2 text-slate-600 hover:bg-slate-200"
              >
                ×
              </button>
            </div>
            <div className="space-y-4 px-6 py-5">
              <div className="grid grid-cols-2 gap-4">
                <div className="rounded-2xl bg-slate-50 p-4">
                  <p className="text-xs uppercase text-slate-500">Amount</p>
                  <p className="mt-1 text-xl font-semibold text-slate-900">{fmt(selectedEntry.totalAmount)}</p>
                </div>
                <div className="rounded-2xl bg-slate-50 p-4">
                  <p className="text-xs uppercase text-slate-500">Days worked</p>
                  <p className="mt-1 text-xl font-semibold text-slate-900">{selectedEntry.daysWorked}</p>
                </div>
              </div>

              {selectedEntry.projectBreakdown && selectedEntry.projectBreakdown.length > 1 ? (
                <div className="rounded-2xl border border-slate-200 p-4">
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-sm font-medium text-slate-700">Multiple project breakdown</p>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setPayOption("site")}
                        className={`rounded-full px-3 py-1 text-xs font-semibold ${payOption === "site" ? "bg-orange-500 text-white" : "bg-slate-100 text-slate-600"}`}
                      >
                        Single site
                      </button>
                      <button
                        type="button"
                        onClick={() => setPayOption("split")}
                        className={`rounded-full px-3 py-1 text-xs font-semibold ${payOption === "split" ? "bg-orange-500 text-white" : "bg-slate-100 text-slate-600"}`}
                      >
                        Split equally
                      </button>
                    </div>
                  </div>

                  {payOption === "site" ? (
                    <div className="space-y-3">
                      <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500">Site</label>
                      <select
                        value={selectedProjectId}
                        onChange={(e) => setSelectedProjectId(e.target.value)}
                        className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none"
                      >
                        <option value="">Select a site</option>
                        {selectedEntry.projectBreakdown.map((item) => item.project && (
                          <option key={item.project._id} value={item.project._id}>{item.project.name}</option>
                        ))}
                      </select>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {calculateEntrySplit(selectedEntry).map((split) => (
                        <div key={split.project?._id} className="rounded-2xl bg-slate-50 p-3 text-sm text-slate-700">
                          <div className="font-semibold text-slate-900">{split.project?.name}</div>
                          <div className="mt-1 text-slate-600">{fmt(split.amount)}</div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <div className="rounded-2xl border border-slate-200 p-4">
                  <p className="text-sm text-slate-600">Payment will be posted to {selectedEntry.project?.name || "selected site"}.</p>
                </div>
              )}
            </div>
            <div className="flex flex-col gap-3 border-t border-slate-200 px-6 py-4 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={closePayEntryModal}
                className="rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handlePayEntry}
                disabled={payProcessing || (payOption === "site" && !selectedProjectId && selectedEntry.projectBreakdown && selectedEntry.projectBreakdown.length > 1)}
                className="inline-flex items-center justify-center rounded-2xl bg-orange-500 px-4 py-2 text-sm font-semibold text-white hover:bg-orange-600 disabled:opacity-60"
              >
                {payProcessing ? <><Loader2 className="w-4 h-4 animate-spin" />Processing...</> : "Pay entry"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
