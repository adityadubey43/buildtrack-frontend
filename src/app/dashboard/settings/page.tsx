"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { Building2, CreditCard, Bell, Shield, Save, CheckCircle, Clock, AlertCircle, Zap } from "lucide-react";
import { getUser, setUser, type User } from "@/lib/store";
import { api } from "@/lib/api";

declare global { interface Window { Razorpay: any; } } // eslint-disable-line @typescript-eslint/no-explicit-any

function loadRazorpay(): Promise<boolean> {
  return new Promise((resolve) => {
    if (window.Razorpay) return resolve(true);
    const s = document.createElement("script");
    s.src = "https://checkout.razorpay.com/v1/checkout.js";
    s.onload = () => resolve(true);
    s.onerror = () => resolve(false);
    document.body.appendChild(s);
  });
}

const TABS = [
  { id: "company", label: "Company", icon: Building2 },
  { id: "billing", label: "Subscription", icon: CreditCard },
  { id: "notifications", label: "Notifications", icon: Bell },
  { id: "security", label: "Security", icon: Shield },
];

const PLANS = [
  { id: "basic", name: "Basic", price: "₹999/mo", features: "3 projects, 25 workers" },
  { id: "pro", name: "Pro", price: "₹2,499/mo", features: "Unlimited projects & workers" },
  { id: "enterprise", name: "Enterprise", price: "Custom", features: "All features + dedicated support" },
];

const PLAN_PRICES: Record<string, string> = { basic: "₹999", pro: "₹2,499", enterprise: "₹4,999" };

function SettingsContent() {
  const searchParams = useSearchParams();
  const [activeTab, setActiveTab] = useState(searchParams.get("tab") || "company");
  const justActivated = searchParams.get("activated") === "1";
  const [user, setUserState] = useState<User | null>(null);
  const [saved, setSaved] = useState(false);
  const [copied, setCopied] = useState(false);
  const [origin, setOrigin] = useState("");
  const [subLoading, setSubLoading] = useState(false);
  const [subError, setSubError] = useState("");
  const [subSuccess, setSubSuccess] = useState(false);
  const [subBilling, setSubBilling] = useState<"monthly" | "yearly">("monthly");
  const [subPlan, setSubPlan] = useState<string>("pro");

  useEffect(() => {
    setUserState(getUser());
    setOrigin(window.location.origin);
  }, []);

  const MONTHLY_P: Record<string, number> = { basic: 999, pro: 2499, enterprise: 4999 };
  const YEARLY_P:  Record<string, number> = {
    basic:      Math.round(999  * 12 * 0.9),
    pro:        Math.round(2499 * 12 * 0.9),
    enterprise: Math.round(4999 * 12 * 0.9),
  };
  const fmtP = (n: number) => `₹${n.toLocaleString("en-IN")}`;

  const handleActivateSubscription = async () => {
    if (!user) return;
    setSubLoading(true);
    setSubError("");
    try {
      const ok = await loadRazorpay();
      if (!ok) throw new Error("Could not load payment gateway.");

      const planName = subPlan.charAt(0).toUpperCase() + subPlan.slice(1);

      if (subBilling === "yearly") {
        // ── Yearly: one-time Order ──────────────────────────────────────────
        const ord = await api.razorpay.createOrder({ plan: subPlan, email: user.email, companyName: user.companyName });
        new window.Razorpay({
          key: ord.keyId, order_id: ord.orderId,
          name: "BuildTrack",
          description: `${planName} — Yearly (10% off) · ${fmtP(YEARLY_P[subPlan])}/yr`,
          amount: ord.amount, currency: "INR",
          prefill: { name: user.name, email: user.email },
          theme: { color: "#f97316" },
          modal: { ondismiss: () => setSubLoading(false) },
          handler: async (r: { razorpay_payment_id: string; razorpay_order_id: string; razorpay_signature: string }) => {
            try {
              const res = await api.razorpay.activateSubscription({
                razorpay_payment_id: r.razorpay_payment_id,
                razorpay_order_id: r.razorpay_order_id,
                razorpay_signature: r.razorpay_signature,
                billing: "yearly", plan: subPlan,
              });
              const updated = { ...user, ...res.user };
              setUser(updated);
              // Reload so dashboard layout re-reads updated planStatus from localStorage
              window.location.href = "/dashboard/settings?tab=billing&activated=1";
            } catch (e: unknown) { setSubError(e instanceof Error ? e.message : "Activation failed."); }
            finally { setSubLoading(false); }
          },
        }).open();

      } else {
        // ── Monthly: Subscription ───────────────────────────────────────────
        const sub = await api.razorpay.createSubscription({ plan: subPlan, email: user.email, companyName: user.companyName });
        new window.Razorpay({
          key: sub.keyId, subscription_id: sub.subscriptionId,
          name: "BuildTrack",
          description: `${planName} — Monthly · ${fmtP(MONTHLY_P[subPlan])}/mo`,
          prefill: { name: user.name, email: user.email },
          theme: { color: "#f97316" },
          modal: { ondismiss: () => setSubLoading(false) },
          handler: async (r: { razorpay_payment_id?: string; razorpay_subscription_id: string; razorpay_signature?: string }) => {
            console.log("[Razorpay subscription handler]", r);
            try {
              const res = await api.razorpay.activateSubscription({
                razorpay_payment_id: r.razorpay_payment_id || "",
                razorpay_subscription_id: r.razorpay_subscription_id,
                razorpay_signature: r.razorpay_signature || "",
                billing: "monthly", plan: subPlan,
              });
              const updated = { ...user, ...res.user };
              setUser(updated);
              // Reload so dashboard layout re-reads updated planStatus from localStorage
              window.location.href = "/dashboard/settings?tab=billing&activated=1";
            } catch (e: unknown) { setSubError(e instanceof Error ? e.message : "Activation failed."); }
            finally { setSubLoading(false); }
          },
        }).open();
      }
    } catch (e: unknown) {
      setSubError(e instanceof Error ? e.message : "Something went wrong.");
      setSubLoading(false);
    }
  };

  const loginUrl = user?.slug ? `${origin}/c/${user.slug}` : "";
  const copyLink = () => {
    if (!loginUrl) return;
    navigator.clipboard.writeText(loginUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSave = () => {
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="p-4 lg:p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Settings</h1>
        <p className="text-slate-500 text-sm">Manage your company account and preferences</p>
      </div>

      <div className="flex flex-col lg:flex-row gap-6">
        {/* Sidebar tabs */}
        <div className="lg:w-52 flex-shrink-0">
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-2">
            {TABS.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                  activeTab === tab.id
                    ? "bg-orange-500 text-white"
                    : "text-slate-600 hover:bg-slate-50"
                }`}
              >
                <tab.icon className="w-4 h-4" />
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
          {activeTab === "company" && (
            <div className="space-y-5">
              <h2 className="font-bold text-slate-900 text-lg">Company Information</h2>

              {/* Per-company login link to share with employees */}
              {user?.slug && (
                <div className="bg-orange-50 border border-orange-200 rounded-xl p-4">
                  <div className="text-sm font-semibold text-slate-800 mb-1">Your Company Login Link</div>
                  <p className="text-xs text-slate-500 mb-3">Share this with your employees — they sign in to your company here.</p>
                  <div className="flex items-center gap-2">
                    <input
                      readOnly
                      value={loginUrl}
                      className="flex-1 px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white text-slate-700 font-mono"
                    />
                    <button
                      onClick={copyLink}
                      className={`px-4 py-2 rounded-lg text-sm font-semibold ${copied ? "bg-green-500 text-white" : "bg-orange-500 hover:bg-orange-600 text-white"}`}
                    >
                      {copied ? "Copied!" : "Copy"}
                    </button>
                  </div>
                </div>
              )}

              {[
                { label: "Company Name",   value: user?.companyName || "", placeholder: "Your company name" },
                { label: "Admin Name",     value: user?.name || "",        placeholder: "Your name" },
                { label: "Email Address",  value: user?.email || "",       placeholder: "admin@yourcompany.com" },
                { label: "Phone Number",   value: "",                      placeholder: "+91 98765 43210" },
                { label: "Company Address",value: "",                      placeholder: "City, State, PIN" },
                { label: "GST Number",     value: "",                      placeholder: "e.g. 24AABCP1234A1Z5" },
              ].map((f) => (
                <div key={f.label}>
                  <label className="block text-sm font-medium text-slate-700 mb-1">{f.label}</label>
                  <input
                    type="text"
                    defaultValue={f.value}
                    className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-orange-500"
                  />
                </div>
              ))}
              <button
                onClick={handleSave}
                className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-colors ${
                  saved ? "bg-green-500 text-white" : "bg-orange-500 hover:bg-orange-600 text-white"
                }`}
              >
                <Save className="w-4 h-4" />
                {saved ? "Saved!" : "Save Changes"}
              </button>
            </div>
          )}

          {activeTab === "billing" && (
            <div>
              <h2 className="font-bold text-slate-900 text-lg mb-5">Subscription</h2>

              {/* Current plan status */}
              {(() => {
                const status = user?.planStatus || "trial";
                const plan = user?.plan || "pro";
                const planName = plan.charAt(0).toUpperCase() + plan.slice(1);
                const trialEndsAt = user?.trialEndsAt ? new Date(user.trialEndsAt) : null;
                const daysLeft = trialEndsAt ? Math.max(0, Math.ceil((trialEndsAt.getTime() - Date.now()) / 86400000)) : 0;

                return (
                  <div className={`rounded-2xl p-5 mb-6 border-2 ${
                    status === "active" ? "bg-green-50 border-green-200" :
                    status === "trial" && daysLeft <= 2 ? "bg-red-50 border-red-200" :
                    "bg-orange-50 border-orange-200"
                  }`}>
                    <div className="flex items-start justify-between">
                      <div>
                        <div className={`text-xs font-medium mb-1 ${status === "active" ? "text-green-600" : "text-orange-600"}`}>
                          {status === "active" ? "Active Subscription" : status === "trial" ? "Free Trial" : status === "expired" ? "Trial Expired" : "Subscription"}
                        </div>
                        <div className="font-black text-2xl text-slate-900">{planName}</div>
                        <div className="text-slate-500 text-sm">{PLAN_PRICES[plan]}/month</div>
                      </div>
                      <div className="text-right">
                        {status === "active" ? (
                          <span className="inline-flex items-center gap-1 bg-green-100 text-green-700 text-xs font-semibold px-3 py-1 rounded-full">
                            <CheckCircle className="w-3 h-3" /> Active
                          </span>
                        ) : status === "trial" ? (
                          <span className={`inline-flex items-center gap-1 text-xs font-semibold px-3 py-1 rounded-full ${
                            daysLeft <= 2 ? "bg-red-100 text-red-700" : "bg-orange-100 text-orange-700"
                          }`}>
                            <Clock className="w-3 h-3" /> {daysLeft} day{daysLeft !== 1 ? "s" : ""} left
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 bg-red-100 text-red-700 text-xs font-semibold px-3 py-1 rounded-full">
                            <AlertCircle className="w-3 h-3" /> {status}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })()}

              {/* Activate / Change subscription */}
              {user?.planStatus !== "active" && (
                <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5 mb-6">
                  <div className="flex items-start gap-3 mb-5">
                    <div className="w-9 h-9 bg-orange-100 rounded-xl flex items-center justify-center flex-shrink-0">
                      <Zap className="w-5 h-5 text-orange-500" />
                    </div>
                    <div>
                      <div className="font-semibold text-slate-900">Activate your subscription</div>
                      <div className="text-sm text-slate-500 mt-0.5">Choose your plan and billing cycle, then pay via UPI, card, or net banking.</div>
                    </div>
                  </div>

                  {/* Plan selector */}
                  <div className="space-y-2 mb-4">
                    {PLANS.map((plan) => {
                      const mp = { basic: 999, pro: 2499, enterprise: 4999 }[plan.id as "basic"|"pro"|"enterprise"];
                      const yp = Math.round(mp * 12 * 0.9);
                      const p  = subBilling === "yearly" ? yp : mp;
                      const lbl = subBilling === "yearly" ? "/yr" : "/mo";
                      const isSelected = subPlan === plan.id;
                      return (
                        <button key={plan.id} onClick={() => setSubPlan(plan.id)}
                          className={`w-full p-3 rounded-xl border-2 text-left transition-all flex items-center justify-between ${isSelected ? "border-orange-500 bg-orange-50" : "border-slate-200 hover:border-slate-300 bg-white"}`}>
                          <div>
                            <span className="font-semibold text-slate-900 text-sm">{plan.name}</span>
                            <span className="text-slate-500 text-xs ml-2">{plan.features}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-slate-900 text-sm">₹{p.toLocaleString("en-IN")}<span className="text-slate-400 font-normal text-xs">{lbl}</span></span>
                            <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${isSelected ? "border-orange-500 bg-orange-500" : "border-slate-300"}`}>
                              {isSelected && <div className="w-1.5 h-1.5 bg-white rounded-full" />}
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>

                  {/* Billing toggle */}
                  <div className="flex items-center gap-1 bg-slate-100 rounded-xl p-1 mb-4">
                    <button onClick={() => setSubBilling("monthly")}
                      className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-all ${subBilling === "monthly" ? "bg-white shadow text-slate-900" : "text-slate-500"}`}>
                      Monthly
                    </button>
                    <button onClick={() => setSubBilling("yearly")}
                      className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-all flex items-center justify-center gap-1.5 ${subBilling === "yearly" ? "bg-white shadow text-slate-900" : "text-slate-500"}`}>
                      Yearly <span className="bg-green-500 text-white text-xs px-1.5 py-0.5 rounded-full font-bold">-10%</span>
                    </button>
                  </div>

                  {/* Yearly total banner */}
                  {subBilling === "yearly" && (() => {
                    const yp = Math.round({ basic: 999, pro: 2499, enterprise: 4999 }[subPlan as "basic"|"pro"|"enterprise"] * 12 * 0.9);
                    return (
                      <div className="bg-green-50 border border-green-200 rounded-xl px-4 py-3 mb-4 flex items-center justify-between">
                        <div>
                          <p className="text-sm font-semibold text-slate-800">Total charged today</p>
                          <p className="text-xs text-slate-500">One-time annual payment · renews in 1 year</p>
                        </div>
                        <p className="text-xl font-black text-green-700">₹{yp.toLocaleString("en-IN")}</p>
                      </div>
                    );
                  })()}

                  {subError && <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-red-600 text-sm mb-4">{subError}</div>}

                  {(subSuccess || justActivated) ? (
                    <div className="bg-green-50 border border-green-200 rounded-xl px-4 py-3 text-green-700 text-sm flex items-center gap-2">
                      <CheckCircle className="w-4 h-4" /> Subscription activated! Your plan is now active.
                    </div>
                  ) : (
                    <button onClick={handleActivateSubscription} disabled={subLoading}
                      className="w-full py-3 bg-orange-500 hover:bg-orange-600 text-white font-semibold rounded-xl transition-colors flex items-center justify-center gap-2 disabled:opacity-70">
                      {subLoading
                        ? <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Opening payment...</>
                        : <><CreditCard className="w-4 h-4" /> Pay via Razorpay</>}
                    </button>
                  )}
                  <p className="text-xs text-slate-400 text-center mt-2">Powered by Razorpay · UPI / Cards / Net Banking</p>
                </div>
              )}

              {/* Plan overview */}
              <h3 className="font-semibold text-slate-800 mb-3">All Plans</h3>
              <div className="grid sm:grid-cols-3 gap-3">
                {PLANS.map((plan) => (
                  <div key={plan.id}
                    className={`p-4 rounded-xl border-2 transition-all ${plan.id === (user?.plan || "pro") ? "border-orange-500 bg-orange-50" : "border-slate-200"}`}>
                    <div className="font-bold text-slate-900">{plan.name}</div>
                    <div className="text-orange-600 font-semibold text-sm mt-0.5">{plan.price}</div>
                    <div className="text-xs text-slate-500 mt-1">{plan.features}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === "notifications" && (
            <div>
              <h2 className="font-bold text-slate-900 text-lg mb-5">Notification Preferences</h2>
              <div className="space-y-4">
                {[
                  { label: "DPR not submitted alert", desc: "Notify when a project's daily report is missing" },
                  { label: "Payment due reminders", desc: "Remind 3 days before invoice due date" },
                  { label: "Material shortage alerts", desc: "Alert when stock falls below minimum" },
                  { label: "Task deadline reminders", desc: "Remind 24hrs before task deadline" },
                  { label: "Payroll due notifications", desc: "Alert before weekly payroll date" },
                  { label: "Cost overrun warnings", desc: "Alert when project reaches 85% of budget" },
                ].map((n) => (
                  <div key={n.label} className="flex items-center justify-between py-3 border-b border-slate-50">
                    <div>
                      <div className="text-sm font-medium text-slate-800">{n.label}</div>
                      <div className="text-xs text-slate-500">{n.desc}</div>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input type="checkbox" defaultChecked className="sr-only peer" />
                      <div className="w-10 h-5 bg-slate-200 rounded-full peer peer-checked:bg-orange-500 transition-colors after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:w-4 after:h-4 after:bg-white after:rounded-full after:transition-all peer-checked:after:translate-x-5" />
                    </label>
                  </div>
                ))}
              </div>
              <button onClick={handleSave} className="mt-5 flex items-center gap-2 px-5 py-2.5 bg-orange-500 hover:bg-orange-600 text-white rounded-xl text-sm font-semibold">
                <Save className="w-4 h-4" />
                {saved ? "Saved!" : "Save Preferences"}
              </button>
            </div>
          )}

          {activeTab === "security" && (
            <div className="space-y-5">
              <h2 className="font-bold text-slate-900 text-lg">Security Settings</h2>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Current Password</label>
                <input type="password" className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-orange-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">New Password</label>
                <input type="password" className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-orange-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Confirm New Password</label>
                <input type="password" className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-orange-500" />
              </div>
              <button className="flex items-center gap-2 px-5 py-2.5 bg-orange-500 hover:bg-orange-600 text-white rounded-xl text-sm font-semibold">
                <Shield className="w-4 h-4" />
                Update Password
              </button>

              <div className="pt-4 border-t border-slate-100">
                <div className="text-sm font-medium text-slate-800 mb-2">Tenant ID</div>
                <code className="text-xs bg-slate-100 px-3 py-2 rounded-lg block text-slate-600">
                  {user?.tenantId || "tenant_demo"}
                </code>
                <p className="text-xs text-slate-400 mt-1">Your unique company identifier. Never share this.</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function SettingsPage() {
  return (
    <Suspense fallback={<div className="p-6 text-slate-500">Loading...</div>}>
      <SettingsContent />
    </Suspense>
  );
}
