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
  const [user, setUserState] = useState<User | null>(null);
  const [saved, setSaved] = useState(false);
  const [copied, setCopied] = useState(false);
  const [origin, setOrigin] = useState("");
  const [subLoading, setSubLoading] = useState(false);
  const [subError, setSubError] = useState("");
  const [subSuccess, setSubSuccess] = useState(false);

  useEffect(() => {
    setUserState(getUser());
    setOrigin(window.location.origin);
  }, []);

  const handleActivateSubscription = async () => {
    if (!user) return;
    setSubLoading(true);
    setSubError("");
    try {
      const ok = await loadRazorpay();
      if (!ok) throw new Error("Could not load payment gateway.");

      const sub = await api.razorpay.createSubscription({
        plan: user.plan || "pro",
        email: user.email,
        companyName: user.companyName,
      });

      const rzp = new window.Razorpay({
        key: sub.keyId,
        subscription_id: sub.subscriptionId,
        name: "BuildTrack",
        description: `${(user.plan || "pro").charAt(0).toUpperCase() + (user.plan || "pro").slice(1)} Plan — Monthly Subscription`,
        prefill: { name: user.name, email: user.email },
        theme: { color: "#f97316" },
        modal: {
          ondismiss: () => setSubLoading(false),
        },
        handler: async (response: { razorpay_payment_id?: string; razorpay_subscription_id: string; razorpay_signature?: string }) => {
          try {
            // Use the protected activate endpoint — updates existing tenant, no new account created
            const res = await api.razorpay.activateSubscription({
              razorpay_subscription_id: response.razorpay_subscription_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
            });
            // Sync updated user to localStorage + state
            const updated = { ...user, planStatus: res.user.planStatus };
            setUser(updated);
            setUserState(updated);
            setSubSuccess(true);
          } catch (e: unknown) {
            setSubError(e instanceof Error ? e.message : "Subscription activation failed.");
          } finally {
            setSubLoading(false);
          }
        },
      });
      rzp.open();
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
                { label: "Company Name", value: user?.companyName || "Demo Construction Co.", placeholder: "" },
                { label: "Admin Name", value: user?.name || "Admin", placeholder: "" },
                { label: "Email Address", value: user?.email || "", placeholder: "" },
                { label: "Phone Number", value: "+91 98765 43210", placeholder: "" },
                { label: "Company Address", value: "Ahmedabad, Gujarat 380001", placeholder: "" },
                { label: "GST Number", value: "24AABCP1234A1Z5", placeholder: "" },
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

              {/* Activate subscription CTA */}
              {user?.planStatus !== "active" && (
                <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5 mb-6">
                  <div className="flex items-start gap-3 mb-4">
                    <div className="w-9 h-9 bg-orange-100 rounded-xl flex items-center justify-center flex-shrink-0">
                      <Zap className="w-5 h-5 text-orange-500" />
                    </div>
                    <div>
                      <div className="font-semibold text-slate-900">Activate your subscription</div>
                      <div className="text-sm text-slate-500 mt-0.5">
                        Pay via UPI, card, or net banking. Your subscription starts immediately and renews monthly.
                      </div>
                    </div>
                  </div>

                  {subError && (
                    <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-red-600 text-sm mb-4">
                      {subError}
                    </div>
                  )}

                  {subSuccess ? (
                    <div className="bg-green-50 border border-green-200 rounded-xl px-4 py-3 text-green-700 text-sm flex items-center gap-2">
                      <CheckCircle className="w-4 h-4" />
                      Subscription activated! Your plan is now active.
                    </div>
                  ) : (
                    <button
                      onClick={handleActivateSubscription}
                      disabled={subLoading}
                      className="w-full py-3 bg-orange-500 hover:bg-orange-600 text-white font-semibold rounded-xl transition-colors flex items-center justify-center gap-2 disabled:opacity-70"
                    >
                      {subLoading ? (
                        <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Opening payment...</>
                      ) : (
                        <><CreditCard className="w-4 h-4" /> Pay {PLAN_PRICES[user?.plan || "pro"]}/month via Razorpay</>
                      )}
                    </button>
                  )}
                  <p className="text-xs text-slate-400 text-center mt-2">Powered by Razorpay · UPI / Cards / Net Banking · Cancel anytime</p>
                </div>
              )}

              {/* Plan details */}
              <h3 className="font-semibold text-slate-800 mb-3">Plan Features</h3>
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
