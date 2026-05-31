"use client";

import { useState } from "react";
import { X } from "lucide-react";
import { api, type Project } from "@/lib/api";

const EMPLOYEE_ROLES = ["admin", "engineer", "supervisor", "accountant", "office-staff", "other"];

export function AddTeamMemberModal({
  projects,
  onClose,
  onSaved,
}: {
  projects?: Project[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState({
    name: "",
    phone: "",
    email: "",
    password: "",
    role: "engineer",
    monthlySalary: "",
    assignedSite: "",
  });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name) { setErr("Name is required."); return; }
    if (!form.email) { setErr("Email is required."); return; }
    if (!form.password) { setErr("Password is required."); return; }
    if (form.password.length < 8) { setErr("Password must be at least 8 characters."); return; }
    
    setSaving(true);
    setErr("");
    setSuccessMsg("");
    try {
      const res = await api.workers.create({
        name: form.name,
        phone: form.phone,
        email: form.email,
        password: form.password,
        role: form.role,
        workerType: "employee",
        wageType: "monthly",
        dailyWage: 0,
        monthlySalary: Number(form.monthlySalary) || 0,
        assignedSite: form.assignedSite || undefined,
      });
      
      console.log("✅ Team member created:", res);
      setSuccessMsg(`✓ ${form.name} added as team member. They can log in with their email & password.`);
      
      setTimeout(() => {
        setForm({ name: "", phone: "", email: "", password: "", role: "engineer", monthlySalary: "", assignedSite: "" });
        onSaved();
        onClose();
      }, 1500);
    } catch (e: unknown) {
      const errorMsg = e instanceof Error ? e.message : "Failed to save.";
      console.error("❌ Error creating team member:", errorMsg, e);
      setErr(errorMsg);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
        <div className="flex items-center justify-between p-5 border-b border-slate-100">
          <h2 className="font-bold text-slate-900">Add Team Member</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X className="w-5 h-5" /></button>
        </div>
        
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {err && <div className="text-red-600 text-sm bg-red-50 p-3 rounded-lg">{err}</div>}
          {successMsg && <div className="text-green-600 text-sm bg-green-50 p-3 rounded-lg">{successMsg}</div>}
          
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Full Name *</label>
            <input type="text" placeholder="e.g. Rajesh Patel" value={form.name}
              onChange={e => set("name", e.target.value)}
              className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Email Address *</label>
            <input type="email" placeholder="e.g. rajesh@company.com" value={form.email}
              onChange={e => set("email", e.target.value)}
              className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Password (min 8 chars) *</label>
            <input type="password" placeholder="Enter secure password" value={form.password}
              onChange={e => set("password", e.target.value)}
              className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Phone Number</label>
            <input type="tel" placeholder="+91 98765 43210" value={form.phone}
              onChange={e => set("phone", e.target.value)}
              className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Role</label>
            <select value={form.role} onChange={e => set("role", e.target.value)}
              className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
              <option value="admin">Admin</option>
              <option value="engineer">Engineer</option>
              <option value="supervisor">Supervisor</option>
              <option value="accountant">Accountant</option>
              <option value="office-staff">Office Staff</option>
              <option value="other">Other</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Monthly Salary</label>
            <input type="number" placeholder="0" value={form.monthlySalary}
              onChange={e => set("monthlySalary", e.target.value)}
              className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 py-2.5 border border-slate-200 rounded-xl text-slate-600 text-sm font-medium hover:bg-slate-50">Cancel</button>
            <button type="submit" disabled={saving || !form.name || !form.email || !form.password}
              className="flex-1 py-2.5 bg-blue-500 hover:bg-blue-600 text-white rounded-xl text-sm font-semibold disabled:opacity-60">
              {saving ? "Adding..." : "Add Member"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
