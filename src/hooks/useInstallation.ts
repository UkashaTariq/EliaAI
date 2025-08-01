// src/hooks/useInstallation.ts
import { useState, useEffect } from "react";

interface InstallationData {
  identifier: string;
  access_token: string;
  refresh_token?: string;
  locationId?: string;
  userId?: string;
  name?: string;
  email?: string;
  locationName?: string;
  scopes?: string;
  created_at: any;
  updated_at: any;
}

interface CurrentUser {
  id: string;
  name: string;
  email: string;
  phone?: string;
}

interface InstallationContext {
  detectedFrom: string;
  originalIdentifier?: string;
  availableIdentifiers?: string[];
  referrer?: string;
  tokenRefreshed?: boolean;
}

interface UseInstallationResult {
  installation: InstallationData | null;
  currentUser: CurrentUser | null;
  context: InstallationContext | null;
  loading: boolean;
  error: string | null;
  refreshInstallation: () => Promise<void>;
}

export function useInstallation(): UseInstallationResult {
  const [installation, setInstallation] = useState<InstallationData | null>(
    null
  );
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [context, setContext] = useState<InstallationContext | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchInstallationContext = async () => {
    try {
      setLoading(true);
      setError(null);

      // Get current URL parameters
      const urlParams = new URLSearchParams(window.location.search);
      const queryString = urlParams.toString();

      // Add any available context parameters
      const contextParams = new URLSearchParams();

      // Check for GHL context in URL
      [
        "location_id",
        "locationId",
        "user_id",
        "userId",
        "company_id",
        "companyId",
        "account_id",
        "accountId",
      ].forEach((param) => {
        const value = urlParams.get(param);
        if (value) contextParams.set(param, value);
      });

      // Check for GHL context in hash
      if (window.location.hash) {
        const hashParams = new URLSearchParams(window.location.hash.slice(1));
        hashParams.forEach((value, key) => {
          if (
            [
              "location_id",
              "locationId",
              "user_id",
              "userId",
              "company_id",
              "companyId",
            ].includes(key)
          ) {
            contextParams.set(key, value);
          }
        });
      }

      const apiUrl = `/api/auth/installation-context${
        contextParams.toString() ? "?" + contextParams.toString() : ""
      }`;
      console.log("Fetching installation context from:", apiUrl);

      const response = await fetch(apiUrl, {
        headers: {
          "X-Requested-With": "XMLHttpRequest",
          // Add any additional context headers
          "X-Current-URL": window.location.href,
          "X-Referrer": document.referrer || "",
        },
      });

      const data = await response.json();

      if (data.success) {
        setInstallation(data.installation);
        setCurrentUser(data.currentUser || null);
        setContext(data.context);

        console.log("Installation context loaded:", {
          identifier: data.installation.identifier,
          locationId: data.installation.locationId,
          userId: data.installation.userId,
          detectedFrom: data.context.detectedFrom,
        });
      } else {
        setError(data.error || "Failed to load installation context");
        console.error("Installation context error:", data);
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Unknown error";
      setError(errorMessage);
      console.error("Installation context fetch error:", err);
    } finally {
      setLoading(false);
    }
  };

  const refreshInstallation = async () => {
    await fetchInstallationContext();
  };

  useEffect(() => {
    fetchInstallationContext();
  }, []);

  return {
    installation,
    currentUser,
    context,
    loading,
    error,
    refreshInstallation,
  };
}

// Helper function to get installation data directly (for use in API calls)
export async function getInstallationContext(): Promise<{
  installation: InstallationData | null;
  currentUser: CurrentUser | null;
  context: InstallationContext | null;
}> {
  try {
    const urlParams = new URLSearchParams(window.location.search);
    const contextParams = new URLSearchParams();

    [
      "location_id",
      "locationId",
      "user_id",
      "userId",
      "company_id",
      "companyId",
      "account_id",
      "accountId",
    ].forEach((param) => {
      const value = urlParams.get(param);
      if (value) contextParams.set(param, value);
    });

    const response = await fetch(
      `/api/auth/installation-context?${contextParams.toString()}`,
      {
        headers: {
          "X-Requested-With": "XMLHttpRequest",
          "X-Current-URL": window.location.href,
          "X-Referrer": document.referrer || "",
        },
      }
    );

    const data = await response.json();

    if (data.success) {
      return {
        installation: data.installation,
        currentUser: data.currentUser || null,
        context: data.context,
      };
    } else {
      return {
        installation: null,
        currentUser: null,
        context: null,
      };
    }
  } catch (error) {
    console.error("Failed to get installation context:", error);
    return {
      installation: null,
      currentUser: null,
      context: null,
    };
  }
}
