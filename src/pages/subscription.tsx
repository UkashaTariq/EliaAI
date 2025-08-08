import { useState, useEffect } from "react";
import { useRouter } from "next/router";
import { 
  Crown, 
  ArrowLeft,
  Check,
  Zap,
  TrendingUp,
  Users,
  DollarSign,
  Calendar
} from "lucide-react";
import SubscriptionBanner from "../components/SubscriptionBanner";
import UpgradeModal from "../components/UpgradeModal";

interface SessionData {
  authenticated: boolean;
  user: {
    identifier: string;
    locationId: string;
    name?: string;
    email?: string;
    locationName?: string;
  };
  subscription: {
    planName: string;
    planId: string;
    status: string;
    searchLimit?: number;
    searchesUsed?: number;
    monthlyFee?: number;
    enrichmentPrice?: number;
    enrichmentsUsed?: number;
    enrichmentCostAccrued?: number;
    isWhiteLabel?: boolean;
    contactLimit?: number;
    currentPeriodStart: string;
    currentPeriodEnd: string;
  };
}

export default function SubscriptionPage() {
  const router = useRouter();
  const [sessionData, setSessionData] = useState<SessionData | null>(null);
  const [loading, setLoading] = useState(true);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [cancelling, setCancelling] = useState(false);

  useEffect(() => {
    checkSession();
  }, []);

  const checkSession = async () => {
    try {
      const response = await fetch("/api/auth/session");
      const data = await response.json();
      
      if (data.authenticated && data.user) {
        setSessionData(data);
      } else {
        router.push("/api/auth/start");
      }
    } catch (error) {
      console.error("Session check failed:", error);
      router.push("/api/auth/start");
    } finally {
      setLoading(false);
    }
  };

  const handleCancelSubscription = async () => {
    if (!confirm("Are you sure you want to cancel your subscription? You'll lose access to unlimited searches and contact enrichment.")) {
      return;
    }

    setCancelling(true);
    try {
      const response = await fetch("/api/ghl/cancel", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
      });

      const data = await response.json();

      if (response.ok) {
        alert("Subscription cancelled successfully. You'll retain access until the end of your current billing period.");
        // Refresh the page to show updated subscription status
        window.location.reload();
      } else {
        throw new Error(data.error || "Failed to cancel subscription");
      }
    } catch (error) {
      console.error("Cancellation error:", error);
      alert("Failed to cancel subscription. Please try again or contact support.");
    } finally {
      setCancelling(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center">
        <div className="text-white">Loading...</div>
      </div>
    );
  }

  if (!sessionData) {
    return null;
  }

  const { subscription } = sessionData;
  const remainingSearches = (subscription.searchLimit || 0) - (subscription.searchesUsed || 0);
  const remainingContacts = subscription.contactLimit ? subscription.contactLimit - (subscription.enrichmentsUsed || 0) : null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <button
            onClick={() => router.push("/dashboard")}
            className="p-2 hover:bg-white/10 rounded-lg transition-colors"
          >
            <ArrowLeft className="w-6 h-6 text-indigo-300" />
          </button>
          <div>
            <h1 className="text-3xl font-bold text-white flex items-center gap-3">
              <Crown className="w-8 h-8 text-yellow-400" />
              Subscription Management
            </h1>
            <p className="text-indigo-300 mt-2">
              Manage your plan, usage, and billing settings
            </p>
          </div>
        </div>

        {/* Subscription Banner */}
        <div className="mb-8">
          <SubscriptionBanner 
            subscription={sessionData?.subscription}
            onUpgrade={() => setShowUpgradeModal(true)}
          />
        </div>

        {/* Trial Expiration Warning */}
        {subscription.planId === "trial" && (
          <div className="mb-8">
            <div className="bg-gradient-to-r from-amber-900/30 to-orange-900/30 border border-amber-600/50 rounded-xl p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Calendar className="w-6 h-6 text-amber-400" />
                <div>
                  <h3 className="text-lg font-semibold text-white">
                    Trial Expires: {new Date(subscription.currentPeriodEnd).toLocaleDateString()}
                  </h3>
                  <p className="text-sm text-amber-200">
                    Subscribe now to continue using EliaAI with unlimited searches and contact enrichment
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowUpgradeModal(true)}
                className="px-6 py-2 bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white font-medium rounded-lg transition-all shadow-lg"
              >
                Subscribe Now
              </button>
            </div>
          </div>
        )}

        {/* Usage Statistics */}
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <div className="bg-slate-800/50 rounded-xl p-6 border border-indigo-700/30">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-indigo-600/20 rounded-lg">
                <Zap className="w-5 h-5 text-indigo-400" />
              </div>
              <h3 className="text-lg font-semibold text-white">Basic Searches</h3>
            </div>
            <div className="space-y-2">
              <p className="text-2xl font-bold text-white">
                {(subscription.searchesUsed || 0).toLocaleString()}
              </p>
              <p className="text-sm text-indigo-300">
                {subscription.planId === "trial" 
                  ? `${remainingSearches} remaining today`
                  : "Unlimited searches"}
              </p>
            </div>
          </div>

          <div className="bg-slate-800/50 rounded-xl p-6 border border-indigo-700/30">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-green-600/20 rounded-lg">
                <Users className="w-5 h-5 text-green-400" />
              </div>
              <h3 className="text-lg font-semibold text-white">Enrichments</h3>
            </div>
            <div className="space-y-2">
              <p className="text-2xl font-bold text-white">
                {(subscription.enrichmentsUsed || 0).toLocaleString()}
              </p>
              <p className="text-sm text-indigo-300">
                {subscription.isWhiteLabel && remainingContacts !== null
                  ? `${remainingContacts} remaining`
                  : `$${subscription.enrichmentPrice || 0}/contact`}
              </p>
            </div>
          </div>

          <div className="bg-slate-800/50 rounded-xl p-6 border border-indigo-700/30">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-yellow-600/20 rounded-lg">
                <DollarSign className="w-5 h-5 text-yellow-400" />
              </div>
              <h3 className="text-lg font-semibold text-white">This Period</h3>
            </div>
            <div className="space-y-2">
              <p className="text-2xl font-bold text-white">
                ${((subscription.monthlyFee || 0) + (subscription.enrichmentCostAccrued || 0)).toFixed(2)}
              </p>
              <p className="text-sm text-indigo-300">
                ${subscription.monthlyFee || 0} platform + ${(subscription.enrichmentCostAccrued || 0).toFixed(2)} usage
              </p>
            </div>
          </div>

          <div className="bg-slate-800/50 rounded-xl p-6 border border-indigo-700/30">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-purple-600/20 rounded-lg">
                <Calendar className="w-5 h-5 text-purple-400" />
              </div>
              <h3 className="text-lg font-semibold text-white">Billing Period</h3>
            </div>
            <div className="space-y-2">
              <p className="text-xl font-bold text-white">
                {new Date(subscription.currentPeriodEnd).toLocaleDateString()}
              </p>
              <p className="text-sm text-indigo-300">
                Next billing date
              </p>
            </div>
          </div>
        </div>

        {/* Plan Details */}
        <div className="bg-slate-800/50 rounded-xl p-8 border border-indigo-700/30 mb-8">
          <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-3">
            <TrendingUp className="w-6 h-6 text-indigo-400" />
            Current Plan Details
          </h2>
          
          <div className="grid md:grid-cols-2 gap-8">
            <div>
              <h3 className="text-lg font-semibold text-white mb-4">Plan Features</h3>
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Check className="w-5 h-5 text-green-400" />
                  <span className="text-indigo-200">
                    {subscription.planId === "free" 
                      ? `${subscription.searchLimit} searches per month`
                      : "Unlimited basic searches"}
                  </span>
                </div>
                
                {subscription.planId !== "free" && (
                  <>
                    <div className="flex items-center gap-2">
                      <Check className="w-5 h-5 text-green-400" />
                      <span className="text-indigo-200">
                        Contact enrichment (email, phone, insights)
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Check className="w-5 h-5 text-green-400" />
                      <span className="text-indigo-200">
                        Search history & exports
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Check className="w-5 h-5 text-green-400" />
                      <span className="text-indigo-200">
                        Priority support
                      </span>
                    </div>
                  </>
                )}
                
                {subscription.planId === "enterprise" && (
                  <>
                    <div className="flex items-center gap-2">
                      <Check className="w-5 h-5 text-green-400" />
                      <span className="text-indigo-200">
                        White-label options
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Check className="w-5 h-5 text-green-400" />
                      <span className="text-indigo-200">
                        Dedicated account manager
                      </span>
                    </div>
                  </>
                )}
              </div>
            </div>

            <div>
              <h3 className="text-lg font-semibold text-white mb-4">Billing Information</h3>
              <div className="space-y-4">
                <div className="flex justify-between items-center p-3 bg-slate-700/30 rounded-lg">
                  <span className="text-indigo-200">Platform Access Fee</span>
                  <span className="text-white font-semibold">
                    ${subscription.monthlyFee}/month
                  </span>
                </div>
                
                {subscription.planId !== "free" && (
                  <div className="flex justify-between items-center p-3 bg-slate-700/30 rounded-lg">
                    <span className="text-indigo-200">Enrichment Rate</span>
                    <span className="text-white font-semibold">
                      ${subscription.enrichmentPrice || 0}/contact
                    </span>
                  </div>
                )}

                <div className="flex justify-between items-center p-3 bg-indigo-900/30 rounded-lg border border-indigo-600/30">
                  <span className="text-indigo-200 font-medium">Current Period Total</span>
                  <span className="text-white font-bold text-lg">
                    ${((subscription.monthlyFee || 0) + (subscription.enrichmentCostAccrued || 0)).toFixed(2)}
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-8 pt-6 border-t border-slate-700 flex justify-between items-center">
            <div className="flex gap-3">
              <button
                onClick={() => setShowUpgradeModal(true)}
                className="px-6 py-3 bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white font-medium rounded-lg transition-all flex items-center gap-2 shadow-lg"
              >
                <Crown className="w-5 h-5" />
                {subscription.planId === "trial" ? "Subscribe" : "Change Plan"}
              </button>
              
              {subscription.planId !== "trial" && subscription.status === "active" && (
                <button
                  onClick={handleCancelSubscription}
                  disabled={cancelling}
                  className="px-6 py-3 border border-red-600/50 text-red-400 hover:bg-red-900/30 rounded-lg transition-all flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {cancelling ? "Cancelling..." : "Cancel Subscription"}
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Upgrade Modal */}
        <UpgradeModal
          isOpen={showUpgradeModal}
          onClose={() => setShowUpgradeModal(false)}
          currentPlan={subscription.planId}
        />
      </div>
    </div>
  );
}