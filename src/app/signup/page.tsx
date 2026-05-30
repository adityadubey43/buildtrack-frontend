"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Building2, Eye, EyeOff, CheckCircle, ArrowRight,
  CreditCard, Shield, Clock, AlertCircle,
} from "lucide-react";
import { api } from "@/lib/api";
import { setUser, setToken } from "@/lib/store";

// ── Types ─────────────────────────────────────────────────────────────────────
declare global {
  interface Window {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    Razorpay: any;
  }
}

// ── Constants ─────────────────────────────────────────────────────────────────
const PLANS = [
  {
    id: "basic" as const,
    name: "Basic",
    price: "₹999",
    perMonth: "/mo",
    desc: "Up to 3 projects, 25 workers",
    features: ["3 active projects", "25 workers", "Attendance & payroll", "Basic reports"],
  },
  {
    id: "pro" as const,
    name: "Pro",
    price: "₹2,499",
    perMonth: "/mo",
    desc: "Unlimited projects & workers",
    popular: true,
    features: ["Unlimited projects", "Unlimited workers", "DPR & materials", "Advanced analytics", "Equipment tracking"],
  },
  {
    id: "enterprise" as const,
    name: "Enterprise",
    price: "₹4,999",
    perMonth: "/mo",
    desc: "Large firms, custom SLA",
    features: ["Everything in Pro", "Priority support", "Custom SLA", "Dedicated onboarding"],
  },
];

// ── Load Razorpay script dynamically ──────────────────────────────────────────
function loadRazorpayScript(): Promise<boolean> {
  return new Promise((resolve) => {
    if (window.Razorpay) return resolve(true);
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
}

// ── Component ─────────────────────────────────────────────────────────────────
export default function SignupPage() {
  const router = useRouter();
  const [step, setStep] = useState<"form" | "plan" | "payment">("form");
  const [selectedPlan, setSelectedPlan] = useState<"basic" | "pro" | "enterprise">("pro");
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [apiError, setApiError] = useState("");

  const [form, setForm] = useState({
    companyName: "",
    adminName: "",
    email: "",
    password: "",
    phone: "",
  });

  // ── Validation ──────────────────────────────────────────────────────────────
  const validate = () => {
    const e: Record<string, string> = {};
    if (!form.companyName.trim()) e.companyName = "Company name is required";
    if (!form.adminName.trim()) e.adminName = "Your name is required";
    if (!form.email.match(/^[^@]+@[^@]+\.[^@]+$/)) e.email = "Valid email required";
    if (form.password.length < 8) e.password = "Password must be at least 8 characters";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleNext = (e: React.FormEvent) => {
    e.preventDefault();
    setApiError("");
    if (validate()) setStep("plan");
  };

  // ── Open Razorpay checkout ──────────────────────────────────────────────────
  const handleStartPayment = async () => {
    setLoading(true);
    setApiError("");

    try {
      // 1. Load Razorpay script
      const ok = await loadRazorpayScript();
      if (!ok) throw new Error("Could not load payment gateway. Please check your connection.");

      // 2. Create subscription on backend (start_at = now + 7 days → no charge today)
      const sub = await api.razorpay.createSubscription({
        plan: selectedPlan,
        email: form.email,
        companyName: form.companyName,
      });

      // 3. Open Razorpay checkout
      const rzp = new window.Razorpay({
        key: sub.keyId,
        subscription_id: sub.subscriptionId,
        name: "BuildTrack",
        description: `${selectedPlan.charAt(0).toUpperCase() + selectedPlan.slice(1)} Plan — 7-day free trial`,
        image: "https://buildtrack-api-svpk.onrender.com/uploads/logo.png",
        prefill: {
          name: form.adminName,
          email: form.email,
          contact: form.phone,
        },
        theme: { color: "#f97316" },
        modal: {
          ondismiss: () => {
            setLoading(false);
            setApiError("Payment cancelled. Please try again to activate your trial.");
          },
        },

        // 4. On success — verify & create account
        // Note: for future-start subscriptions (trial flow), razorpay_payment_id
        // may be absent — backend verifies via Razorpay API instead of HMAC.
        handler: async (response: {
          razorpay_payment_id?: string;
          razorpay_subscription_id: string;
          razorpay_signature?: string;
        }) => {
          try {
            const res = await api.razorpay.verifyAndSignup({
              razorpay_payment_id: response.razorpay_payment_id ?? "",
              razorpay_subscription_id: response.razorpay_subscription_id,
              razorpay_signature: response.razorpay_signature ?? "",
              companyName: form.companyName,
              adminName: form.adminName,
              email: form.email,
              password: form.password,
              phone: form.phone,
              plan: selectedPlan,
            });
            setToken(res.token);
            setUser(res.user);
            router.push("/dashboard");
          } catch (err: unknown) {
            setApiError(
              err instanceof Error
                ? err.message
                : "Payment verified but account creation failed. Please contact support."
            );
            setLoading(false);
          }
        },
      });

      rzp.open();
    } catch (err: unknown) {
      setApiError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
      setLoading(false);
    }
  };

  const planDetails = PLANS.find((p) => p.id === selectedPlan)!;

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-slate-50 flex">
      {/* Left brand panel */}
      <div className="hidden lg:flex lg:w-2/5 gradient-hero flex-col justify-between p-12">
        <Link href="/" className="flex items-center gap-2">
          <div className="w-9 h-9 bg-orange-500 rounded-lg flex items-center justify-center">
            <Building2 className="w-5 h-5 text-white" />
          </div>
          <span className="text-white font-bold text-xl">
            Build<span className="text-orange-400">Track</span>
          </span>
        </Link>

        <div>
          <h2 className="text-3xl font-bold text-white mb-4">
            Start managing your construction sites smarter.
          </h2>
          <p className="text-slate-300 mb-8">
            Join 500+ construction companies across India using BuildTrack.
          </p>
          <div className="space-y-4">
            {[
              "7-day free trial — cancel anytime",
              "Your own isolated company workspace",
              "Mobile-ready for field teams",
              "GST-ready billing & invoicing",
              "Auto-billing after trial via UPI / Card",
            ].map((b) => (
              <div key={b} className="flex items-center gap-3 text-slate-300 text-sm">
                <CheckCircle className="w-4 h-4 text-green-400 flex-shrink-0" />
                {b}
              </div>
            ))}
          </div>
        </div>

        {/* Step indicator */}
        <div className="space-y-2">
          {[
            { label: "Company Details", s: "form" },
            { label: "Choose Plan", s: "plan" },
            { label: "Add Payment Method", s: "payment" },
          ].map((item, i) => (
            <div key={item.s} className="flex items-center gap-3">
              <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                step === item.s
                  ? "bg-orange-500 text-white"
                  : (step === "plan" && i === 0) || (step === "payment" && i <= 1)
                  ? "bg-green-500 text-white"
                  : "bg-white/20 text-slate-400"
              }`}>
                {(step === "plan" && i === 0) || (step === "payment" && i <= 1) ? "✓" : i + 1}
              </div>
              <span className={`text-sm ${step === item.s ? "text-white font-medium" : "text-slate-400"}`}>
                {item.label}
              </span>
            </div>
          ))}
        </div>

        <p className="text-slate-500 text-xs">© 2026 BuildTrack. All rights reserved.</p>
      </div>

      {/* Right form */}
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-md">
          <div className="lg:hidden flex items-center gap-2 mb-8">
            <div className="w-8 h-8 bg-orange-500 rounded-lg flex items-center justify-center">
              <Building2 className="w-4 h-4 text-white" />
            </div>
            <span className="text-slate-900 font-bold text-lg">
              Build<span className="text-orange-500">Track</span>
            </span>
          </div>

          {apiError && (
            <div className="mb-4 bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-red-600 text-sm flex items-start gap-2">
              <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
              {apiError}
            </div>
          )}

          {/* ── Step 1: Company Details ── */}
          {step === "form" && (
            <>
              <div className="mb-8">
                <h1 className="text-2xl font-bold text-slate-900 mb-1">Create your company account</h1>
                <p className="text-slate-500 text-sm">
                  Already have an account?{" "}
                  <Link href="/login" className="text-orange-500 hover:underline font-medium">Sign in</Link>
                </p>
              </div>

              <form onSubmit={handleNext} className="space-y-4">
                {[
                  { key: "companyName", label: "Company Name", placeholder: "Patel Constructions Pvt Ltd", type: "text" },
                  { key: "adminName", label: "Your Name (Admin)", placeholder: "Rajesh Patel", type: "text" },
                  { key: "email", label: "Email Address", placeholder: "admin@yourcompany.com", type: "email" },
                  { key: "phone", label: "Phone Number", placeholder: "+91 98765 43210", type: "tel" },
                ].map((f) => (
                  <div key={f.key}>
                    <label className="block text-sm font-medium text-slate-700 mb-1">{f.label}</label>
                    <input
                      type={f.type}
                      placeholder={f.placeholder}
                      value={form[f.key as keyof typeof form]}
                      onChange={(e) => setForm({ ...form, [f.key]: e.target.value })}
                      className={`w-full px-4 py-2.5 border rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-orange-500 text-sm ${errors[f.key] ? "border-red-400" : "border-slate-200"}`}
                    />
                    {errors[f.key] && <p className="text-red-500 text-xs mt-1">{errors[f.key]}</p>}
                  </div>
                ))}

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Password</label>
                  <div className="relative">
                    <input
                      type={showPass ? "text" : "password"}
                      placeholder="Min. 8 characters"
                      value={form.password}
                      onChange={(e) => setForm({ ...form, password: e.target.value })}
                      className={`w-full px-4 py-2.5 border rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-orange-500 text-sm pr-10 ${errors.password ? "border-red-400" : "border-slate-200"}`}
                    />
                    <button type="button" onClick={() => setShowPass(!showPass)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400">
                      {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  {errors.password && <p className="text-red-500 text-xs mt-1">{errors.password}</p>}
                </div>

                <button type="submit" className="w-full py-3 bg-orange-500 hover:bg-orange-600 text-white font-semibold rounded-xl transition-colors flex items-center justify-center gap-2">
                  Continue to Plan Selection <ArrowRight className="w-4 h-4" />
                </button>

                <p className="text-xs text-slate-400 text-center">
                  By signing up, you agree to our{" "}
                  <a href="#" className="text-orange-500">Terms</a> and{" "}
                  <a href="#" className="text-orange-500">Privacy Policy</a>
                </p>
              </form>
            </>
          )}

          {/* ── Step 2: Plan Selection ── */}
          {step === "plan" && (
            <>
              <div className="mb-8">
                <button onClick={() => setStep("form")} className="text-slate-500 text-sm hover:text-orange-500 mb-4 flex items-center gap-1">
                  ← Back
                </button>
                <h1 className="text-2xl font-bold text-slate-900 mb-1">Choose your plan</h1>
                <p className="text-slate-500 text-sm">All plans include a 7-day free trial. No charge today.</p>
              </div>

              <div className="space-y-3 mb-6">
                {PLANS.map((plan) => (
                  <button
                    key={plan.id}
                    onClick={() => setSelectedPlan(plan.id)}
                    className={`w-full p-4 rounded-xl border-2 text-left transition-all ${selectedPlan === plan.id ? "border-orange-500 bg-orange-50" : "border-slate-200 hover:border-slate-300"}`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className="font-semibold text-slate-900">{plan.name}</span>
                          {"popular" in plan && plan.popular && (
                            <span className="text-xs bg-orange-500 text-white px-2 py-0.5 rounded-full">Popular</span>
                          )}
                        </div>
                        <div className="text-slate-500 text-xs">{plan.desc}</div>
                      </div>
                      <div className="flex items-center gap-2 ml-3">
                        <div className="text-right">
                          <span className="font-bold text-slate-900">{plan.price}</span>
                          <span className="text-slate-400 text-xs">{plan.perMonth}</span>
                        </div>
                        <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${selectedPlan === plan.id ? "border-orange-500 bg-orange-500" : "border-slate-300"}`}>
                          {selectedPlan === plan.id && <div className="w-2 h-2 bg-white rounded-full" />}
                        </div>
                      </div>
                    </div>
                  </button>
                ))}
              </div>

              <button
                onClick={() => setStep("payment")}
                className="w-full py-3 bg-orange-500 hover:bg-orange-600 text-white font-semibold rounded-xl transition-colors flex items-center justify-center gap-2"
              >
                Continue to Payment <ArrowRight className="w-4 h-4" />
              </button>
            </>
          )}

          {/* ── Step 3: Payment ── */}
          {step === "payment" && (
            <>
              <div className="mb-8">
                <button onClick={() => setStep("plan")} className="text-slate-500 text-sm hover:text-orange-500 mb-4 flex items-center gap-1">
                  ← Back
                </button>
                <h1 className="text-2xl font-bold text-slate-900 mb-1">Add payment method</h1>
                <p className="text-slate-500 text-sm">You won't be charged today. Trial starts after you authorize.</p>
              </div>

              {/* Order summary */}
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 mb-6">
                <div className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-3">Order Summary</div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-slate-700 font-medium">BuildTrack {planDetails.name}</span>
                  <span className="font-bold text-slate-900">{planDetails.price}<span className="text-slate-400 font-normal text-xs">/mo</span></span>
                </div>
                <div className="flex items-center justify-between text-sm text-slate-500 mb-3">
                  <span>Company</span>
                  <span>{form.companyName}</span>
                </div>
                <div className="border-t border-slate-200 pt-3">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-700 font-medium">Due today</span>
                    <span className="text-green-600 font-bold text-lg">₹0</span>
                  </div>
                  <div className="flex items-center justify-between text-xs text-slate-400 mt-0.5">
                    <span>After 7-day trial</span>
                    <span>{planDetails.price}/month</span>
                  </div>
                </div>
              </div>

              {/* Trust signals */}
              <div className="grid grid-cols-3 gap-3 mb-6">
                {[
                  { icon: Clock, label: "7 days free" },
                  { icon: Shield, label: "Secure payment" },
                  { icon: CreditCard, label: "UPI / Card" },
                ].map(({ icon: Icon, label }) => (
                  <div key={label} className="flex flex-col items-center gap-1.5 p-3 bg-slate-50 rounded-xl border border-slate-200 text-center">
                    <Icon className="w-4 h-4 text-orange-500" />
                    <span className="text-xs text-slate-600 font-medium">{label}</span>
                  </div>
                ))}
              </div>

              <button
                onClick={handleStartPayment}
                disabled={loading}
                className="w-full py-3.5 bg-orange-500 hover:bg-orange-600 text-white font-semibold rounded-xl transition-colors flex items-center justify-center gap-2 disabled:opacity-70 text-base"
              >
                {loading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Opening payment gateway…
                  </>
                ) : (
                  <>
                    <CreditCard className="w-4 h-4" />
                    Authorise & Start Free Trial
                  </>
                )}
              </button>

              <p className="text-xs text-slate-400 text-center mt-3">
                Powered by Razorpay · 256-bit SSL encryption · Cancel anytime
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
