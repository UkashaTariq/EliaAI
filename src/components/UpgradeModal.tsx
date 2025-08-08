// src/components/UpgradeModal.tsx
import React, { useState } from "react";
import { X, Check, Crown, Zap, Loader2, Star } from "lucide-react";

interface Plan {
  id: string;
  name: string;
  monthlyFee: number;
  enrichmentPrice: number;
  description: string;
  features: string[];
  popular?: boolean;
  isTrial?: boolean;
}

interface UpgradeModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentPlan: string;
}

const PLANS: Plan[] = [
  {
    id: "trial",
    name: "7-Day Free Trial",
    monthlyFee: 0,
    enrichmentPrice: 0,
    description:
      "3 searches per day • 7-day trial period • No contact enrichment • Basic search only",
    features: [
      "3 basic searches per day",
      "7-day trial period",
      "No contact enrichment",
      "Standard support",
    ],
    isTrial: true,
  },
  {
    id: "starter",
    name: "Starter Plan",
    monthlyFee: 29,
    enrichmentPrice: 1.25,
    description: "Perfect for small agencies getting started",
    features: [
      "Unlimited basic searches",
      "Full contact enrichment",
      "$1.25 per enriched contact",
      "Search history & exports",
      "Priority support",
    ],
    popular: true,
  },
  {
    id: "pro",
    name: "Pro Plan",
    monthlyFee: 99,
    enrichmentPrice: 0.85,
    description: "Best for growing agencies with higher volume",
    features: [
      "Unlimited basic searches",
      "Full contact enrichment",
      "$0.85 per enriched contact (32% savings)",
      "Advanced filtering & targeting",
      "Priority support",
    ],
  },
  {
    id: "enterprise",
    name: "Enterprise Plan",
    monthlyFee: 199,
    enrichmentPrice: 0.75,
    description: "For high-volume agencies and teams",
    features: [
      "Unlimited basic searches",
      "Full contact enrichment",
      "$0.75 per enriched contact (40% savings)",
      "White-label options",
      "Dedicated account manager",
      "Priority support & training",
    ],
  },
];

export default function UpgradeModal({
  isOpen,
  onClose,
  currentPlan,
}: UpgradeModalProps) {
  const [loading, setLoading] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleUpgrade = async (planType: string) => {
    if (planType === "trial" || planType === currentPlan) return;

    setLoading(planType);

    try {
      // Determine if this is an upgrade from trial or a plan switch
      const isUpgradeFromTrial = currentPlan === "trial";
      const endpoint = isUpgradeFromTrial
        ? "/api/ghl/subscribe"
        : "/api/ghl/switch-plan";
      const body = isUpgradeFromTrial
        ? { planId: planType }
        : { newPlanId: planType };

      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });

      const data = await response.json();

      if (response.ok) {
        const url = data.subscribeUrl || data.changeUrl;
        if (url) {
          // Redirect to GHL Marketplace
          window.open(url, "_blank");
        } else if (data.success) {
          // Plan switched successfully without redirect
          alert("Plan updated successfully!");
          window.location.reload();
        }
      } else {
        throw new Error(data.error || "Failed to process plan change");
      }
    } catch (error) {
      console.error("Upgrade error:", error);
      alert("Failed to start upgrade process. Please try again.");
    } finally {
      setLoading(null);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-slate-900 rounded-xl shadow-2xl max-w-6xl w-full max-h-[90vh] overflow-auto border border-indigo-700/30">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-indigo-800/50">
          <div className="flex items-center gap-3">
            <Crown className="w-6 h-6 text-yellow-400" />
            <h2 className="text-xl font-bold text-white">Upgrade Your Plan</h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-white/10 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-indigo-300" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          <p className="text-indigo-200 mb-6 text-center">
            Upgrade your plan through GoHighLevel Marketplace for seamless
            billing integration
          </p>

          <div className="grid md:grid-cols-4 gap-6">
            {PLANS.map((plan) => {
              const isCurrent = plan.id === currentPlan;
              const isUpgrade = plan.id !== "trial" && plan.id !== currentPlan;
              const isDisabled = plan.id === "trial" || isCurrent;

              return (
                <div
                  key={plan.id}
                  className={`rounded-xl border-2 p-6 relative ${
                    plan.popular
                      ? "border-purple-500 bg-gradient-to-b from-purple-900/20 to-indigo-900/20"
                      : isCurrent
                      ? "border-green-500 bg-gradient-to-b from-green-900/20 to-emerald-900/20"
                      : "border-slate-600 bg-slate-800/50"
                  }`}
                >
                  {plan.popular && (
                    <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                      <div className="bg-purple-500 text-white text-xs font-bold px-3 py-1 rounded-full flex items-center gap-1">
                        <Star className="w-3 h-3" />
                        Most Popular
                      </div>
                    </div>
                  )}

                  {isCurrent && (
                    <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                      <div className="bg-green-500 text-white text-xs font-bold px-3 py-1 rounded-full flex items-center gap-1">
                        <Check className="w-3 h-3" />
                        Current Plan
                      </div>
                    </div>
                  )}

                  <div className="text-center">
                    <div className="flex justify-center mb-4">
                      {plan.id === "trial" ? (
                        <Zap className="w-8 h-8 text-slate-400" />
                      ) : (
                        <Crown className="w-8 h-8 text-yellow-400" />
                      )}
                    </div>

                    <h3 className="text-lg font-bold text-white mb-2">
                      {plan.name}
                    </h3>

                    <div className="text-3xl font-bold text-white mb-1">
                      {plan.isTrial ? (
                        "Trial"
                      ) : (
                        <>
                          ${plan.monthlyFee}
                          <span className="text-sm text-slate-400">/month</span>
                        </>
                      )}
                    </div>

                    {!plan.isTrial && (
                      <div className="text-lg text-indigo-300 mb-2">
                        + ${plan.enrichmentPrice}/contact enriched
                      </div>
                    )}

                    <p className="text-sm text-slate-400 mb-4">
                      {plan.description}
                    </p>

                    <div className="space-y-2 mb-6 text-left">
                      {plan.features.map((feature, index) => (
                        <div
                          key={index}
                          className="flex items-center gap-2 text-sm text-slate-300"
                        >
                          <Check className="w-4 h-4 text-green-400" />
                          <span>{feature}</span>
                        </div>
                      ))}
                    </div>

                    <button
                      // onClick={() => handleUpgrade(plan.id)}
                      onClick={() => {}}
                      disabled={isDisabled || loading === plan.id}
                      className={`w-full py-2 px-4 rounded-lg font-medium transition-all ${
                        isCurrent
                          ? "bg-green-600 text-white cursor-default"
                          : isUpgrade
                          ? "bg-gradient-to-r from-purple-500 to-indigo-600 hover:from-purple-600 hover:to-indigo-700 text-white shadow-lg"
                          : "bg-slate-700 text-slate-400 cursor-not-allowed"
                      }`}
                    >
                      {loading === plan.id ? (
                        <div className="flex items-center justify-center gap-2">
                          <Loader2 className="w-4 h-4 animate-spin" />
                          Processing...
                        </div>
                      ) : isCurrent ? (
                        "Current Plan"
                      ) : plan.id === "trial" ? (
                        "Trial Period"
                      ) : currentPlan === "trial" ? (
                        `Subscribe via GHL`
                      ) : (
                        `Switch Plan`
                      )}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
