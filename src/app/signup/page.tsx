"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Building2, Eye, EyeOff, CheckCircle, ArrowRight, CreditCard, Clock, Zap } from "lucide-react";
import { api } from "@/lib/api";
import { setUser, setToken } from "@/lib/store";

declare global { interface Window { Razorpay: any; } } // eslint-disable-line @typescript-eslint/no-explicit-any

// ── Pricing ────────────────────────────────────────────────────────────────────
const MONTHLY = { basic: 999, pro: 2499, enterprise: 4999 };
const YEARLY  = {
  basic:      Math.round(MONTHLY.basic      * 12 * 0.9),
  pro:        Math.round(MONTHLY.pro        * 12 * 0.9),
  enterprise: Math.round(MONTHLY.enterprise * 12 * 0.9),
};
const savings = (plan: keyof typeof MONTHLY) =>
  MONTHLY[plan] * 12 - YEARLY[plan];

const PLANS = [
  { id: "basic"      as const, name: "Basic",      desc: "Up to 3 projects, 25 workers" },
  { id: "pro"        as const, name: "Pro",         desc: "Unlimited projects & workers", popular: true },
  { id: "enterprise" as const, name: "Enterprise",  desc: "Large firms, custom SLA" },
];

function fmt(n: number) { return `₹${n.toLocaleString("en-IN")}`; }

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

export default function SignupPage() {
  const router = useRouter();
  const [step, setStep] = useState<"form" | "plan">("form");
  const [billing, setBilling] = useState<"monthly" | "yearly">("monthly");
  const [selectedPlan, setSelectedPlan] = useState<"basic" | "pro" | "enterprise">("pro");
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState<"trial" | "pay" | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [apiError, setApiError] = useState("");
  const [form, setForm] = useState({ companyName: "", adminName: "", email: "", password: "", phone: "" });

  const validate = () => {
    const e: Record<string, string> = {};
    if (!form.companyName.trim()) e.companyName = "Company name is required";
    if (!form.adminName.trim())   e.adminName   = "Your name is required";
    if (!form.email.match(/^[^@]+@[^@]+\.[^@]+$/)) e.email = "Valid email required";
    if (form.password.length < 8) e.password = "Min. 8 characters";
    setErrors(e);
    return !Object.keys(e).length;
  };

  const handleNext = (e: React.FormEvent) => { e.preventDefault(); setApiError(""); if (validate()) setStep("plan"); };

  // ── Free trial ──────────────────────────────────────────────────────────────
  const handleStartTrial = async () => {
    setLoading("trial"); setApiError("");
    try {
      const res = await api.auth.signup({ companyName: form.companyName, adminName: form.adminName, email: form.email, password: form.password, phone: form.phone, plan: selectedPlan });
      setToken(res.token); setUser(res.user); router.push("/dashboard");
    } catch (err: unknown) {
      setApiError(err instanceof Error ? err.message : "Signup failed.");
      setLoading(null);
    }
  };

  // ── Pay now ─────────────────────────────────────────────────────────────────
  const handlePayNow = async () => {
    setLoading("pay"); setApiError("");
    try {
      const ok = await loadRazorpay();
      if (!ok) throw new Error("Could not load payment gateway.");

      const sub = await api.razorpay.createSubscription({ plan: selectedPlan, billing, email: form.email, companyName: form.companyName });

      const price = billing === "yearly" ? YEARLY[selectedPlan] : MONTHLY[selectedPlan];
      const planName = PLANS.find(p => p.id === selectedPlan)!.name;
      const billingLabel = billing === "yearly" ? "Yearly (10% off)" : "Monthly";

      const rzp = new window.Razorpay({
        key: sub.keyId,
        subscription_id: sub.subscriptionId,
        name: "BuildTrack",
        description: `${planName} — ${billingLabel}`,
        prefill: { name: form.adminName, email: form.email, contact: form.phone },
        theme: { color: "#f97316" },
        modal: { ondismiss: () => { setLoading(null); setApiError("Payment cancelled. You can start a free trial instead."); } },
        handler: async (response: { razorpay_payment_id?: string; razorpay_subscription_id: string; razorpay_signature?: string }) => {
          try {
            const res = await api.razorpay.verifyAndSignup({
              razorpay_payment_id: response.razorpay_payment_id ?? "",
              razorpay_subscription_id: response.razorpay_subscription_id,
              razorpay_signature: response.razorpay_signature ?? "",
              companyName: form.companyName, adminName: form.adminName,
              email: form.email, password: form.password, phone: form.phone, plan: selectedPlan,
            });
            setToken(res.token); setUser(res.user); router.push("/dashboard");
          } catch (err: unknown) {
            setApiError(err instanceof Error ? err.message : "Account creation failed. Please contact support.");
            setLoading(null);
          }
        },
      });
      rzp.open();
    } catch (err: unknown) {
      setApiError(err instanceof Error ? err.message : "Something went wrong.");
      setLoading(null);
    }
  };

  const price   = billing === "yearly" ? YEARLY[selectedPlan]   : MONTHLY[selectedPlan];
  const perLabel = billing === "yearly" ? "/yr"                  : "/mo";

  return (
    <div className="min-h-screen bg-slate-50 flex">
      {/* Left panel */}
      <div className="hidden lg:flex lg:w-2/5 gradient-hero flex-col justify-between p-12">
        <Link href="/" className="flex items-center gap-2">
          <div className="w-9 h-9 bg-orange-500 rounded-lg flex items-center justify-center"><Building2 className="w-5 h-5 text-white" /></div>
          <span className="text-white font-bold text-xl">Build<span className="text-orange-400">Track</span></span>
        </Link>
        <div>
          <h2 className="text-3xl font-bold text-white mb-4">Start managing your construction sites smarter.</h2>
          <p className="text-slate-300 mb-8">Join 500+ construction companies across India.</p>
          <div className="space-y-4">
            {["7-day free trial, no card required", "Monthly or Yearly billing — save 10% yearly", "Your own isolated company workspace", "Mobile-ready for field teams", "GST-ready billing & invoicing"].map((b) => (
              <div key={b} className="flex items-center gap-3 text-slate-300 text-sm">
                <CheckCircle className="w-4 h-4 text-green-400 flex-shrink-0" />{b}
              </div>
            ))}
          </div>
        </div>
        <p className="text-slate-500 text-xs">© 2026 BuildTrack. All rights reserved.</p>
      </div>

      {/* Right form */}
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-md">
          <div className="lg:hidden flex items-center gap-2 mb-8">
            <div className="w-8 h-8 bg-orange-500 rounded-lg flex items-center justify-center"><Building2 className="w-4 h-4 text-white" /></div>
            <span className="text-slate-900 font-bold text-lg">Build<span className="text-orange-500">Track</span></span>
          </div>

          {apiError && <div className="mb-4 bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-red-600 text-sm">{apiError}</div>}

          {/* ── Step 1: Company details ── */}
          {step === "form" && (
            <>
              <div className="mb-8">
                <h1 className="text-2xl font-bold text-slate-900 mb-1">Create your company account</h1>
                <p className="text-slate-500 text-sm">Already have an account? <Link href="/login" className="text-orange-500 hover:underline font-medium">Sign in</Link></p>
              </div>
              <form onSubmit={handleNext} className="space-y-4">
                {[
                  { key: "companyName", label: "Company Name",     placeholder: "Patel Constructions Pvt Ltd", type: "text" },
                  { key: "adminName",   label: "Your Name (Admin)", placeholder: "Rajesh Patel",               type: "text" },
                  { key: "email",       label: "Email Address",     placeholder: "admin@yourcompany.com",      type: "email" },
                  { key: "phone",       label: "Phone Number",      placeholder: "+91 98765 43210",            type: "tel" },
                ].map((f) => (
                  <div key={f.key}>
                    <label className="block text-sm font-medium text-slate-700 mb-1">{f.label}</label>
                    <input type={f.type} placeholder={f.placeholder} value={form[f.key as keyof typeof form]}
                      onChange={(e) => setForm({ ...form, [f.key]: e.target.value })}
                      className={`w-full px-4 py-2.5 border rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-orange-500 text-sm ${errors[f.key] ? "border-red-400" : "border-slate-200"}`} />
                    {errors[f.key] && <p className="text-red-500 text-xs mt-1">{errors[f.key]}</p>}
                  </div>
                ))}
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Password</label>
                  <div className="relative">
                    <input type={showPass ? "text" : "password"} placeholder="Min. 8 characters" value={form.password}
                      onChange={(e) => setForm({ ...form, password: e.target.value })}
                      className={`w-full px-4 py-2.5 border rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-orange-500 text-sm pr-10 ${errors.password ? "border-red-400" : "border-slate-200"}`} />
                    <button type="button" onClick={() => setShowPass(!showPass)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400">
                      {showPass ? <Eye className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  {errors.password && <p className="text-red-500 text-xs mt-1">{errors.password}</p>}
                </div>
                <button type="submit" className="w-full py-3 bg-orange-500 hover:bg-orange-600 text-white font-semibold rounded-xl transition-colors flex items-center justify-center gap-2">
                  Continue to Plan Selection <ArrowRight className="w-4 h-4" />
                </button>
                <p className="text-xs text-slate-400 text-center">By signing up you agree to our <a href="#" className="text-orange-500">Terms</a> &amp; <a href="#" className="text-orange-500">Privacy Policy</a></p>
              </form>
            </>
          )}

          {/* ── Step 2: Plan + billing toggle ── */}
          {step === "plan" && (
            <>
              <div className="mb-6">
                <button onClick={() => setStep("form")} className="text-slate-500 text-sm hover:text-orange-500 mb-4 flex items-center gap-1">← Back</button>
                <h1 className="text-2xl font-bold text-slate-900 mb-1">Choose your plan</h1>
                <p className="text-slate-500 text-sm">Start free or subscribe directly — your choice.</p>
              </div>

              {/* ── Billing toggle ── */}
              <div className="flex items-center gap-2 bg-slate-100 rounded-xl p-1 mb-6">
                <button onClick={() => setBilling("monthly")}
                  className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-all ${billing === "monthly" ? "bg-white shadow text-slate-900" : "text-slate-500 hover:text-slate-700"}`}>
                  Monthly
                </button>
                <button onClick={() => setBilling("yearly")}
                  className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-all flex items-center justify-center gap-2 ${billing === "yearly" ? "bg-white shadow text-slate-900" : "text-slate-500 hover:text-slate-700"}`}>
                  Yearly
                  <span className="text-xs bg-green-500 text-white px-1.5 py-0.5 rounded-full font-bold">-10%</span>
                </button>
              </div>

              {/* ── Plan cards ── */}
              <div className="space-y-3 mb-6">
                {PLANS.map((plan) => {
                  const p = billing === "yearly" ? YEARLY[plan.id] : MONTHLY[plan.id];
                  const isSelected = selectedPlan === plan.id;
                  return (
                    <button key={plan.id} onClick={() => setSelectedPlan(plan.id)}
                      className={`w-full p-4 rounded-xl border-2 text-left transition-all ${isSelected ? "border-orange-500 bg-orange-50" : "border-slate-200 hover:border-slate-300"}`}>
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-0.5">
                            <span className="font-semibold text-slate-900">{plan.name}</span>
                            {"popular" in plan && plan.popular && <span className="text-xs bg-orange-500 text-white px-2 py-0.5 rounded-full">Popular</span>}
                          </div>
                          <div className="text-slate-500 text-xs">{plan.desc}</div>
                          {billing === "yearly" && (
                            <div className="text-green-600 text-xs font-medium mt-1">
                              Save {fmt(savings(plan.id))}/year
                            </div>
                          )}
                        </div>
                        <div className="flex items-center gap-2 ml-3">
                          <div className="text-right">
                            {billing === "yearly" && (
                              <div className="text-xs text-slate-400 line-through">{fmt(MONTHLY[plan.id] * 12)}/yr</div>
                            )}
                            <span className="font-bold text-slate-900">{fmt(p)}</span>
                            <span className="text-slate-400 text-xs">{perLabel}</span>
                          </div>
                          <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${isSelected ? "border-orange-500 bg-orange-500" : "border-slate-300"}`}>
                            {isSelected && <div className="w-2 h-2 bg-white rounded-full" />}
                          </div>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* ── CTAs ── */}
              <div className="space-y-3">
                <button onClick={handlePayNow} disabled={loading !== null}
                  className="w-full py-3.5 bg-orange-500 hover:bg-orange-600 text-white font-semibold rounded-xl transition-colors flex items-center justify-center gap-2 disabled:opacity-70">
                  {loading === "pay"
                    ? <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Opening payment...</>
                    : <><Zap className="w-4 h-4" /> Subscribe Now — {fmt(price)}{perLabel}</>}
                </button>

                <div className="flex items-center gap-3">
                  <div className="flex-1 h-px bg-slate-200" />
                  <span className="text-xs text-slate-400 font-medium">or</span>
                  <div className="flex-1 h-px bg-slate-200" />
                </div>

                <button onClick={handleStartTrial} disabled={loading !== null}
                  className="w-full py-3.5 border-2 border-slate-200 hover:border-orange-300 hover:bg-orange-50 text-slate-700 font-semibold rounded-xl transition-colors flex items-center justify-center gap-2 disabled:opacity-70">
                  {loading === "trial"
                    ? <><div className="w-4 h-4 border-2 border-slate-400/30 border-t-slate-500 rounded-full animate-spin" /> Creating workspace...</>
                    : <><Clock className="w-4 h-4 text-slate-500" /> Start 7-Day Free Trial</>}
                </button>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-3">
                <div className="bg-orange-50 border border-orange-100 rounded-xl p-3 text-center">
                  <Zap className="w-4 h-4 text-orange-500 mx-auto mb-1" />
                  <div className="text-xs font-semibold text-slate-800">Subscribe Now</div>
                  <div className="text-xs text-slate-500 mt-0.5">Pay today, use forever</div>
                </div>
                <div className="bg-slate-50 border border-slate-100 rounded-xl p-3 text-center">
                  <Clock className="w-4 h-4 text-slate-400 mx-auto mb-1" />
                  <div className="text-xs font-semibold text-slate-800">Free Trial</div>
                  <div className="text-xs text-slate-500 mt-0.5">No card · 7 days free</div>
                </div>
              </div>
              <p className="text-xs text-slate-400 text-center mt-3">Powered by Razorpay · UPI / Cards / Net Banking</p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
