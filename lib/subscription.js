// Simple subscription utilities
export class SubscriptionManager {
  constructor() {
    this.storageKey = 'ghl_subscription';
  }

  // Get current plan from localStorage
  getCurrentPlan() {
    if (typeof window === 'undefined') return 'trial';
    
    const stored = localStorage.getItem(this.storageKey);
    return stored ? JSON.parse(stored).plan : 'trial';
  }

  // Update plan (called from webhooks or API)
  updatePlan(planData) {
    if (typeof window === 'undefined') return;
    
    localStorage.setItem(this.storageKey, JSON.stringify({
      plan: planData.plan,
      status: planData.status,
      updatedAt: Date.now(),
      features: planData.features
    }));
  }

  // Check if feature is available
  canUseFeature(feature) {
    const plan = this.getCurrentPlan();
    
    const features = {
      trial: {
        searches: 3,
        unlimited: false,
        export: false,
        priority_support: false
      },
      pro: {
        searches: -1, // unlimited
        unlimited: true,
        export: true,
        priority_support: true
      },
      enterprise: {
        searches: -1,
        unlimited: true,
        export: true,
        priority_support: true,
        whitelabel: true,
        custom_integrations: true
      }
    };

    return features[plan]?.[feature] || false;
  }

  // Track usage for trial users
  trackUsage(action) {
    if (typeof window === 'undefined') return;
    
    const plan = this.getCurrentPlan();
    if (plan !== 'trial') return true; // Unlimited for paid plans
    
    const usageKey = `usage_${action}`;
    const current = parseInt(localStorage.getItem(usageKey) || '0');
    const limits = { searches: 3, exports: 1 };
    
    if (current >= (limits[action] || 0)) {
      return false; // Limit exceeded
    }
    
    localStorage.setItem(usageKey, (current + 1).toString());
    return true;
  }
}

// Usage in components
const subscription = new SubscriptionManager();

// Check if user can search
if (!subscription.canUseFeature('unlimited') && !subscription.trackUsage('searches')) {
  showUpgradePrompt();
  return;
}