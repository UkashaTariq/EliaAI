// src/components/SubscriptionBanner.tsx
import React from "react";
import { 
  Crown, 
  AlertTriangle, 
  CheckCircle, 
  Clock,
  Zap 
} from "lucide-react";

interface SubscriptionData {
  planId: string;
  planName: string;
  status: string;
  searchLimit?: number;
  searchesUsed?: number;
  currentPeriodEnd: string | Date;
  billingSource?: string;
}

interface SubscriptionBannerProps {
  subscription: SubscriptionData | null | undefined;
  onUpgrade?: () => void;
}

export default function SubscriptionBanner({ 
  subscription, 
  onUpgrade 
}: SubscriptionBannerProps) {
  // Handle undefined/null subscription
  if (!subscription) {
    return null;
  }

  const remainingSearches = Math.max(0, (subscription.searchLimit || 0) - (subscription.searchesUsed || 0));
  const usagePercentage = ((subscription.searchesUsed || 0) / (subscription.searchLimit || 1)) * 100;
  
  const isTrial = subscription.planId === 'trial';
  const isLowUsage = remainingSearches <= 2;
  const isExceeded = remainingSearches === 0;

  const getStatusColor = () => {
    if (isExceeded) return "bg-red-500";
    if (isLowUsage) return "bg-yellow-500";
    return "bg-green-500";
  };

  const getStatusIcon = () => {
    if (isExceeded) return <AlertTriangle className="w-4 h-4" />;
    if (isLowUsage) return <Clock className="w-4 h-4" />;
    return <CheckCircle className="w-4 h-4" />;
  };

  return (
    <div className={`rounded-xl p-4 border ${
      isTrial 
        ? 'bg-gradient-to-r from-slate-800/50 to-slate-700/50 border-slate-600/30' 
        : 'bg-gradient-to-r from-purple-800/50 to-indigo-800/50 border-purple-600/30'
    }`}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          {isTrial ? (
            <Zap className="w-5 h-5 text-slate-400" />
          ) : (
            <Crown className="w-5 h-5 text-yellow-400" />
          )}
          <span className="font-semibold text-white">
            {subscription.planName}
          </span>
          <div className={`flex items-center gap-1 px-2 py-1 rounded-full text-xs text-white ${getStatusColor()}`}>
            {getStatusIcon()}
            <span>{subscription.status}</span>
          </div>
        </div>
        
        {isTrial && onUpgrade && (
          <button
            onClick={onUpgrade}
            className="px-4 py-2 bg-gradient-to-r from-purple-500 to-indigo-600 hover:from-purple-600 hover:to-indigo-700 text-white text-sm font-medium rounded-lg transition-all shadow-lg"
          >
            Subscribe
          </button>
        )}
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between text-sm">
          <span className="text-slate-300">Search Usage</span>
          <span className={`font-medium ${
            isExceeded ? 'text-red-400' : 
            isLowUsage ? 'text-yellow-400' : 
            'text-green-400'
          }`}>
            {subscription.searchesUsed || 0} / {subscription.searchLimit || 0}
          </span>
        </div>
        
        <div className="w-full bg-slate-700/50 rounded-full h-2">
          <div 
            className={`h-2 rounded-full transition-all duration-300 ${
              isExceeded ? 'bg-red-500' :
              isLowUsage ? 'bg-yellow-500' :
              'bg-green-500'
            }`}
            style={{ width: `${Math.min(usagePercentage, 100)}%` }}
          />
        </div>

        {isExceeded ? (
          <div className="flex items-center gap-2 text-sm text-red-400 mt-2">
            <AlertTriangle className="w-4 h-4" />
            <span>Search limit reached. Upgrade via GoHighLevel marketplace to continue.</span>
          </div>
        ) : isLowUsage ? (
          <div className="flex items-center gap-2 text-sm text-yellow-400 mt-2">
            <Clock className="w-4 h-4" />
            <span>{remainingSearches} searches remaining this period.</span>
          </div>
        ) : (
          <div className="text-sm text-slate-400 mt-2">
            {remainingSearches} searches remaining until{" "}
            {new Date(subscription.currentPeriodEnd).toLocaleDateString()}
            {subscription.billingSource === 'ghl_marketplace' && (
              <span className="ml-2 text-xs text-green-400">(GHL Marketplace)</span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}