// src/pages/index.tsx - Complete Landing Page
import { useState, useEffect } from "react";
import { useRouter } from "next/router";
import Link from "next/link";
import {
  Search,
  Users,
  Zap,
  Shield,
  ArrowRight,
  CheckCircle,
  Loader2,
  Bot,
  Target,
  Database,
  Sparkles,
  Clock,
  TrendingUp,
} from "lucide-react";

export default function Home() {
  const router = useRouter();
  const [isConnecting, setIsConnecting] = useState(false);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);

  // Check if user is already authenticated
  useEffect(() => {
    checkExistingAuth();
  }, []);

  const checkExistingAuth = async () => {
    try {
      console.log("Starting GHL authentication check...");

      // Method 1: Check URL parameters first (OAuth callback)
      const urlParams = new URLSearchParams(window.location.search);
      const urlIdentifier = urlParams.get("identifier");

      if (urlIdentifier) {
        console.log("Found identifier in URL:", urlIdentifier);
        const response = await fetch(
          `/api/auth/verify?identifier=${urlIdentifier}`
        );

        if (response.ok) {
          console.log("URL identifier is valid, redirecting to dashboard");
          router.push(`/dashboard?identifier=${urlIdentifier}`);
          return;
        } else {
          console.error("Invalid identifier in URL");
        }
      }

      // Method 2: Check for GHL marketplace context
      const locationId =
        urlParams.get("location_id") || urlParams.get("locationId");
      const userId = urlParams.get("user_id") || urlParams.get("userId");
      const companyId =
        urlParams.get("company_id") || urlParams.get("companyId");

      console.log("Checking GHL context:", { locationId, userId, companyId });

      // Method 3: Try to detect current GHL user via marketplace API
      if (
        window.location.origin.includes("gohighlevel.com") ||
        window.location.origin.includes("leadconnectorhq.com") ||
        document.referrer.includes("gohighlevel.com") ||
        document.referrer.includes("leadconnectorhq.com")
      ) {
        console.log("Detected GHL environment, checking for current user...");

        try {
          // Check if we can access GHL's current user context
          const ghlContextResponse = await fetch(
            "/api/auth/ghl-context?" +
              new URLSearchParams({
                locationId: locationId || "",
                userId: userId || "",
                companyId: companyId || "",
              })
          );

          if (ghlContextResponse.ok) {
            const contextData = await ghlContextResponse.json();
            console.log("GHL context response:", contextData);

            if (contextData.authenticated) {
              console.log(
                "Found authenticated GHL user, redirecting to dashboard"
              );
              router.push(contextData.dashboardUrl);
              return;
            } else if (contextData.requiresInstall) {
              console.log("User authenticated with GHL but app not installed");
            } else {
              console.log("GHL user found but not authenticated with our app");
            }
          }
        } catch (error) {
          console.error("GHL context check failed:", error);
        }
      }

      // Method 4: Check if we're in an iframe context (embedded in GHL)
      if (window.parent !== window) {
        console.log(
          "Detected iframe context, trying to get GHL parent context..."
        );

        try {
          // Request context from parent GHL window
          window.parent.postMessage(
            {
              type: "ELIA_REQUEST_CONTEXT",
              source: "elia-ai-app",
              timestamp: Date.now(),
            },
            "*"
          );

          // Wait for response with timeout
          const contextResponse: any = await new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
              console.log("Iframe context request timed out");
              reject(new Error("Context timeout"));
            }, 5000);

            const handleMessage = (event: any) => {
              console.log("Received message from parent:", event.data);

              if (
                event.data.type === "GHL_CONTEXT_RESPONSE" &&
                event.data.target === "elia-ai-app"
              ) {
                clearTimeout(timeout);
                window.removeEventListener("message", handleMessage);
                resolve(event.data);
              }
            };

            window.addEventListener("message", handleMessage);

            // Also try to get context via direct parent access (if same origin)
            setTimeout(() => {
              try {
                if (window.parent.location.origin === window.location.origin) {
                  // Same origin, we can potentially access parent context
                  const parentUrl = new URL(window.parent.location.href);
                  const parentLocationId =
                    parentUrl.searchParams.get("locationId");
                  const parentUserId = parentUrl.searchParams.get("userId");

                  if (parentLocationId || parentUserId) {
                    clearTimeout(timeout);
                    window.removeEventListener("message", handleMessage);
                    resolve({
                      type: "GHL_CONTEXT_RESPONSE",
                      context: {
                        locationId: parentLocationId,
                        userId: parentUserId,
                      },
                    });
                  }
                }
              } catch (e) {
                // Cross-origin restriction, ignore
                console.log("Cannot access parent location (cross-origin)");
              }
            }, 1000);
          });

          if (contextResponse && contextResponse.context) {
            console.log(
              "Received context from parent:",
              contextResponse.context
            );

            const { locationId: parentLocationId, userId: parentUserId } =
              contextResponse.context;

            if (parentLocationId || parentUserId) {
              const contextCheckResponse = await fetch(
                `/api/auth/ghl-context?locationId=${
                  parentLocationId || ""
                }&userId=${parentUserId || ""}`
              );

              if (contextCheckResponse.ok) {
                const contextData = await contextCheckResponse.json();

                if (contextData.authenticated) {
                  console.log("Parent context authentication successful");
                  router.push(contextData.dashboardUrl);
                  return;
                }
              }
            }
          }
        } catch (error) {
          console.log("Iframe context detection failed:", error);
        }
      }

      // Method 5: Check document referrer for GHL context
      if (document.referrer) {
        console.log("Checking referrer for GHL context:", document.referrer);

        if (
          document.referrer.includes("gohighlevel.com") ||
          document.referrer.includes("leadconnectorhq.com")
        ) {
          try {
            const referrerUrl = new URL(document.referrer);
            const refLocationId =
              referrerUrl.searchParams.get("locationId") ||
              referrerUrl.searchParams.get("location_id");
            const refUserId =
              referrerUrl.searchParams.get("userId") ||
              referrerUrl.searchParams.get("user_id");

            if (refLocationId || refUserId) {
              console.log("Found GHL context in referrer:", {
                refLocationId,
                refUserId,
              });

              const response = await fetch(
                `/api/auth/ghl-context?locationId=${
                  refLocationId || ""
                }&userId=${refUserId || ""}`
              );

              if (response.ok) {
                const contextData = await response.json();
                if (contextData.authenticated) {
                  console.log("Referrer context authentication successful");
                  router.push(contextData.dashboardUrl);
                  return;
                }
              }
            }
          } catch (error) {
            console.log("Failed to parse referrer URL:", error);
          }
        }
      }

      // Method 6: Final fallback - try the detect-user API
      try {
        console.log("Trying detect-user API as final fallback...");
        const detectionResponse = await fetch("/api/auth/detect-user");

        if (detectionResponse.ok) {
          const detectionData = await detectionResponse.json();
          console.log("User detection result:", detectionData);

          if (detectionData.detected && detectionData.authenticated) {
            console.log(
              "Fallback detection successful, redirecting to dashboard"
            );
            router.push(`/dashboard?identifier=${detectionData.identifier}`);
            return;
          }
        }
      } catch (error) {
        console.error("Fallback detection failed:", error);
      }

      // No authentication found - show landing page
      console.log("No valid authentication found, showing landing page");
    } catch (error) {
      console.error("Auth check failed:", error);
    } finally {
      setIsCheckingAuth(false);
    }
  };

  const handleConnect = () => {
    setIsConnecting(true);
    // Redirect to GoHighLevel OAuth
    window.location.href = "/api/auth/start";
  };

  // Show loading screen while checking auth
  if (isCheckingAuth) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-900 via-purple-900 to-indigo-800 flex items-center justify-center">
        <div className="bg-white/10 backdrop-blur-sm rounded-xl p-8 flex items-center gap-4">
          <Loader2 className="w-6 h-6 text-white animate-spin" />
          <span className="text-white text-lg">Checking authentication...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-900 via-purple-900 to-indigo-800">
      {/* Header */}
      <header className="bg-slate-900/80 backdrop-blur-sm border-b border-indigo-800/30">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-r from-indigo-500 to-purple-600 rounded-xl flex items-center justify-center shadow-lg">
                <Bot className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-white">ELIA AI</h1>
                <p className="text-xs text-indigo-300">
                  Intelligent Contact Discovery
                </p>
              </div>
            </div>
            <nav className="hidden md:flex items-center gap-6 text-indigo-200">
              <a
                href="#features"
                className="hover:text-white transition-colors font-medium"
              >
                Features
              </a>
              <a
                href="#how-it-works"
                className="hover:text-white transition-colors font-medium"
              >
                How it Works
              </a>
              <a
                href="#benefits"
                className="hover:text-white transition-colors font-medium"
              >
                Benefits
              </a>
            </nav>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="py-20 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <div className="inline-flex items-center gap-2 bg-indigo-500/20 backdrop-blur-sm border border-indigo-400/30 rounded-full px-4 py-2 mb-6">
              <Sparkles className="w-4 h-4 text-indigo-300" />
              <span className="text-indigo-200 text-sm font-medium">
                AI-Powered Contact Intelligence
              </span>
            </div>

            <h1 className="text-5xl md:text-7xl font-bold text-white mb-6 leading-tight">
              Unlock AI-Powered
              <span className="block bg-gradient-to-r from-indigo-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">
                Contact Discovery &
              </span>
              <span className="block bg-gradient-to-r from-purple-400 via-pink-400 to-indigo-400 bg-clip-text text-transparent">
                Enrichment
              </span>
            </h1>

            <p className="text-xl md:text-2xl text-indigo-200 mb-10 max-w-4xl mx-auto leading-relaxed">
              Meet ELIA — your new AI search assistant that finds, enriches, and
              personalizes contacts in your GoHighLevel CRM like never before.
              All you have to do is ask.
            </p>

            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center mb-12">
              <button
                onClick={handleConnect}
                disabled={isConnecting}
                className="group px-8 py-4 bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 disabled:from-gray-500 disabled:to-gray-600 disabled:cursor-not-allowed text-white font-semibold rounded-xl transition-all flex items-center gap-3 text-lg shadow-2xl hover:shadow-indigo-500/25 hover:scale-105"
              >
                {isConnecting ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Connecting to GoHighLevel...
                  </>
                ) : (
                  <>
                    Connect GoHighLevel
                    <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                  </>
                )}
              </button>

              <Link
                href="#demo"
                className="px-8 py-4 border-2 border-indigo-400/50 text-indigo-200 hover:bg-indigo-900/30 hover:border-indigo-400 rounded-xl transition-all font-medium hover:scale-105"
              >
                Watch Demo
              </Link>
            </div>

            {/* Trust Indicators */}
            <div className="flex flex-wrap items-center justify-center gap-8 text-indigo-300 text-sm">
              <div className="flex items-center gap-2">
                <Shield className="w-4 h-4" />
                <span>Secure OAuth Integration</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle className="w-4 h-4" />
                <span>GDPR Compliant</span>
              </div>
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4" />
                <span>5-Minute Setup</span>
              </div>
              <div className="flex items-center gap-2">
                <TrendingUp className="w-4 h-4" />
                <span>Instant Results</span>
              </div>
            </div>
          </div>

          {/* Visual Element */}
          <div className="relative">
            <div className="bg-gradient-to-r from-indigo-500/20 to-purple-500/20 backdrop-blur-sm rounded-2xl p-8 border border-indigo-400/20 shadow-2xl">
              <div className="grid md:grid-cols-3 gap-6">
                <div className="text-center p-4">
                  <div className="w-16 h-16 bg-gradient-to-r from-indigo-500 to-purple-600 rounded-xl flex items-center justify-center mx-auto mb-4">
                    <Search className="w-8 h-8 text-white" />
                  </div>
                  <h3 className="text-white font-semibold mb-2">
                    Natural Language Search
                  </h3>
                  <p className="text-indigo-200 text-sm">
                    "Find dentists in Miami with websites"
                  </p>
                </div>
                <div className="text-center p-4">
                  <div className="w-16 h-16 bg-gradient-to-r from-purple-500 to-pink-600 rounded-xl flex items-center justify-center mx-auto mb-4">
                    <Database className="w-8 h-8 text-white" />
                  </div>
                  <h3 className="text-white font-semibold mb-2">
                    Auto-Enrichment
                  </h3>
                  <p className="text-indigo-200 text-sm">
                    Verified emails, phones & social profiles
                  </p>
                </div>
                <div className="text-center p-4">
                  <div className="w-16 h-16 bg-gradient-to-r from-pink-500 to-indigo-600 rounded-xl flex items-center justify-center mx-auto mb-4">
                    <Target className="w-8 h-8 text-white" />
                  </div>
                  <h3 className="text-white font-semibold mb-2">Smart Lists</h3>
                  <p className="text-indigo-200 text-sm">
                    Organized & tagged in your CRM
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-20 px-6 bg-black/20">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-white mb-4">
              Powerful Features for Modern Sales Teams
            </h2>
            <p className="text-xl text-indigo-200 max-w-2xl mx-auto">
              Everything you need to find, qualify, and convert your ideal
              prospects
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-8 border border-white/20 hover:bg-white/15 transition-all group">
              <div className="w-16 h-16 bg-gradient-to-r from-indigo-500 to-purple-600 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                <Search className="w-8 h-8 text-white" />
              </div>
              <h3 className="text-2xl font-semibold text-white mb-4">
                AI-Powered Search
              </h3>
              <p className="text-indigo-200 leading-relaxed">
                Use natural language to find exactly the contacts you need. Just
                describe your ideal customer and let ELIA do the rest.
              </p>
            </div>

            <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-8 border border-white/20 hover:bg-white/15 transition-all group">
              <div className="w-16 h-16 bg-gradient-to-r from-purple-500 to-pink-600 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                <Users className="w-8 h-8 text-white" />
              </div>
              <h3 className="text-2xl font-semibold text-white mb-4">
                Smart Lists
              </h3>
              <p className="text-indigo-200 leading-relaxed">
                Automatically organize contacts into smart lists with advanced
                filtering, tagging, and segmentation capabilities.
              </p>
            </div>

            <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-8 border border-white/20 hover:bg-white/15 transition-all group">
              <div className="w-16 h-16 bg-gradient-to-r from-pink-500 to-indigo-600 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                <Zap className="w-8 h-8 text-white" />
              </div>
              <h3 className="text-2xl font-semibold text-white mb-4">
                Instant Enrichment
              </h3>
              <p className="text-indigo-200 leading-relaxed">
                Enrich contact profiles with verified emails, phone numbers,
                social profiles, and company data automatically.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section id="how-it-works" className="py-20 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-white mb-4">How It Works</h2>
            <p className="text-xl text-indigo-200">
              Get started in minutes, see results instantly
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            <div className="text-center relative">
              <div className="w-20 h-20 bg-gradient-to-r from-indigo-500 to-purple-600 rounded-full flex items-center justify-center mx-auto mb-6 text-white font-bold text-2xl shadow-2xl">
                1
              </div>
              <h3 className="text-2xl font-semibold text-white mb-4">
                Connect
              </h3>
              <p className="text-indigo-200 leading-relaxed">
                Securely connect your GoHighLevel account with one click. Your
                data stays safe and encrypted.
              </p>
              {/* Connecting line */}
              <div className="hidden md:block absolute top-10 left-full w-full h-0.5 bg-gradient-to-r from-indigo-500 to-purple-600 transform -translate-y-1/2"></div>
            </div>

            <div className="text-center relative">
              <div className="w-20 h-20 bg-gradient-to-r from-purple-500 to-pink-600 rounded-full flex items-center justify-center mx-auto mb-6 text-white font-bold text-2xl shadow-2xl">
                2
              </div>
              <h3 className="text-2xl font-semibold text-white mb-4">Search</h3>
              <p className="text-indigo-200 leading-relaxed">
                Ask ELIA to find contacts using natural language queries. No
                complex filters or technical jargon needed.
              </p>
              {/* Connecting line */}
              <div className="hidden md:block absolute top-10 left-full w-full h-0.5 bg-gradient-to-r from-purple-500 to-pink-600 transform -translate-y-1/2"></div>
            </div>

            <div className="text-center">
              <div className="w-20 h-20 bg-gradient-to-r from-pink-500 to-indigo-600 rounded-full flex items-center justify-center mx-auto mb-6 text-white font-bold text-2xl shadow-2xl">
                3
              </div>
              <h3 className="text-2xl font-semibold text-white mb-4">Import</h3>
              <p className="text-indigo-200 leading-relaxed">
                Review and import enriched contacts directly into your CRM with
                smart tags and organized lists.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Benefits Section */}
      <section id="benefits" className="py-20 px-6 bg-black/20">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-white mb-4">
              Why Choose ELIA?
            </h2>
            <p className="text-xl text-indigo-200">
              Transform your prospecting game with AI intelligence
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-8">
            <div className="space-y-6">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 bg-gradient-to-r from-green-500 to-emerald-600 rounded-xl flex items-center justify-center flex-shrink-0">
                  <CheckCircle className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h3 className="text-xl font-semibold text-white mb-2">
                    Save 10+ Hours Per Week
                  </h3>
                  <p className="text-indigo-200">
                    Stop manually searching for contacts. Let AI do the heavy
                    lifting while you focus on closing deals.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-4">
                <div className="w-12 h-12 bg-gradient-to-r from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center flex-shrink-0">
                  <Target className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h3 className="text-xl font-semibold text-white mb-2">
                    Higher Quality Leads
                  </h3>
                  <p className="text-indigo-200">
                    AI-verified contact information means better deliverability
                    and higher response rates.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-4">
                <div className="w-12 h-12 bg-gradient-to-r from-purple-500 to-pink-600 rounded-xl flex items-center justify-center flex-shrink-0">
                  <TrendingUp className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h3 className="text-xl font-semibold text-white mb-2">
                    Boost Conversion Rates
                  </h3>
                  <p className="text-indigo-200">
                    Better targeting and enriched profiles lead to more
                    personalized outreach and higher conversions.
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-gradient-to-br from-indigo-500/20 to-purple-500/20 backdrop-blur-sm rounded-2xl p-8 border border-indigo-400/20">
              <h3 className="text-2xl font-bold text-white mb-6">
                Ready to Get Started?
              </h3>
              <p className="text-indigo-200 mb-6">
                Join thousands of sales professionals who are already using ELIA
                to find and convert more leads.
              </p>
              <button
                onClick={handleConnect}
                disabled={isConnecting}
                className="w-full px-6 py-3 bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 disabled:from-gray-500 disabled:to-gray-600 disabled:cursor-not-allowed text-white font-semibold rounded-xl transition-all flex items-center justify-center gap-3"
              >
                {isConnecting ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Connecting...
                  </>
                ) : (
                  <>
                    Start Free Trial
                    <ArrowRight className="w-5 h-5" />
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 px-6">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-4xl font-bold text-white mb-6">
            Ready to Transform Your Contact Discovery?
          </h2>
          <p className="text-xl text-indigo-200 mb-10">
            Join thousands of sales teams already using ELIA to find and convert
            more leads.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
            <button
              onClick={handleConnect}
              disabled={isConnecting}
              className="px-12 py-4 bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 disabled:from-gray-500 disabled:to-gray-600 disabled:cursor-not-allowed text-white font-semibold rounded-xl transition-all flex items-center gap-3 text-lg shadow-2xl hover:scale-105"
            >
              {isConnecting ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Connecting...
                </>
              ) : (
                <>
                  Get Started Free
                  <ArrowRight className="w-5 h-5" />
                </>
              )}
            </button>
          </div>

          <p className="text-indigo-300 text-sm mt-6">
            No credit card required • 5-minute setup • Instant results
          </p>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-slate-900/80 backdrop-blur-sm border-t border-indigo-800/30 py-12 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="grid md:grid-cols-4 gap-8 mb-8">
            <div>
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 bg-gradient-to-r from-indigo-500 to-purple-600 rounded-xl flex items-center justify-center">
                  <Bot className="w-6 h-6 text-white" />
                </div>
                <span className="text-white font-bold text-lg">ELIA AI</span>
              </div>
              <p className="text-indigo-200 text-sm">
                The most intelligent way to discover and enrich contacts for
                your sales team.
              </p>
            </div>

            <div>
              <h4 className="text-white font-semibold mb-4">Product</h4>
              <ul className="space-y-2 text-indigo-200 text-sm">
                <li>
                  <a
                    href="#features"
                    className="hover:text-white transition-colors"
                  >
                    Features
                  </a>
                </li>
                <li>
                  <a href="#" className="hover:text-white transition-colors">
                    Status
                  </a>
                </li>
              </ul>
            </div>

            <div>
              <h4 className="text-white font-semibold mb-4">Legal</h4>
              <ul className="space-y-2 text-indigo-200 text-sm">
                <li>
                  <a href="#" className="hover:text-white transition-colors">
                    Privacy Policy
                  </a>
                </li>
                <li>
                  <a href="#" className="hover:text-white transition-colors">
                    Terms of Service
                  </a>
                </li>
                <li>
                  <a href="#" className="hover:text-white transition-colors">
                    GDPR
                  </a>
                </li>
                <li>
                  <a href="#" className="hover:text-white transition-colors">
                    Security
                  </a>
                </li>
              </ul>
            </div>
          </div>

          <div className="pt-8 border-t border-indigo-800/30 flex flex-col md:flex-row justify-between items-center">
            <div className="text-indigo-300 text-sm mb-4 md:mb-0">
              © 2025 ELIA AI. All rights reserved.
            </div>
            <div className="flex items-center gap-4 text-indigo-300">
              <span className="text-sm">Made with ❤️ for sales teams</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
