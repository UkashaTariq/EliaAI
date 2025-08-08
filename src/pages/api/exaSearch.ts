import type { NextApiRequest, NextApiResponse } from "next";
import { getSession } from "../../lib/session-utils";
import { checkSearchLimit, recordSearchUsage } from "../../lib/usage-tracking";
import { v4 as uuidv4 } from "uuid";
import { db } from "../../lib/firebaseAdmin";
import type { SearchHistory } from "../../lib/firestore-schema";

interface Contact {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  url?: string;
  summary?: string;
  description?: string;
  location?: string;
}

interface BasicContact {
  id: string;
  name: string;
  url?: string;
  summary?: string;
  // Basic contacts don't include email/phone - that requires enrichment
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "POST") return res.status(405).end();

  try {
    // Check authentication
    const session = await getSession(req, res);

    if (!session.user?.isLoggedIn) {
      return res.status(401).json({
        error: "Not authenticated",
        requiresAuth: true,
      });
    }

    const {
      query,
      maxResults = 100,
      useWebsets = false,
      batchSize = 100,
      enrichContacts = false, // New flag for backward compatibility
    } = req.body as {
      query?: string;
      maxResults?: number;
      useWebsets?: boolean;
      batchSize?: number;
      enrichContacts?: boolean;
    };

    if (!query) return res.status(400).json({ error: "Missing query" });

    // Check search limits
    const limitCheck = await checkSearchLimit(session.user.identifier);

    // Block enrichment for trial users
    if (enrichContacts && limitCheck.subscription.planId === 'trial') {
      return res.status(403).json({
        error: "Contact enrichment is not available during trial period",
        message: "Subscribe to unlock unlimited searches and contact enrichment features",
        upgradeRequired: true,
        subscription: {
          planName: limitCheck.subscription.planName,
          planId: limitCheck.subscription.planId,
          trialDaysRemaining: limitCheck.trialDaysRemaining,
        }
      });
    }

    if (!limitCheck.canSearch) {
      const errorMessage = limitCheck.isTrialExpired 
        ? "Your 7-day trial has expired. Subscribe to continue using EliaAI."
        : limitCheck.subscription.planId === 'trial'
        ? "Daily search limit reached. You'll get 3 more searches tomorrow, or subscribe for unlimited searches."
        : "Search limit exceeded";
        
      return res.status(429).json({
        error: errorMessage,
        subscription: {
          planName: limitCheck.subscription.planName,
          searchLimit: limitCheck.subscription.searchLimit,
          searchesUsed: limitCheck.subscription.searchesUsed,
          remainingSearches: limitCheck.remainingSearches,
          isTrialExpired: limitCheck.isTrialExpired,
          trialDaysRemaining: limitCheck.trialDaysRemaining,
        },
        upgradeRequired: true,
        isTrialExpired: limitCheck.isTrialExpired,
      });
    }

    let contacts: BasicContact[] = [];

    if (useWebsets) {
      // Use Exa Websets approach with batching for large results
      contacts = await handleWebsetsSearch(
        query,
        maxResults,
        batchSize,
        enrichContacts
      );
    } else {
      // Use regular Exa search with batching
      contacts = await handleRegularSearch(
        query,
        maxResults,
        batchSize,
        enrichContacts
      );
    }

    // Generate unique search ID
    const searchId = uuidv4();

    // Record search usage
    await recordSearchUsage(
      session.user.identifier,
      session.user.locationId,
      query,
      contacts.length
    );

    // Store search history
    try {
      console.log(
        "Storing search history for:",
        session.user.identifier,
        "query:",
        query
      );
      const searchHistory: SearchHistory = {
        identifier: session.user.identifier,
        locationId: session.user.locationId,
        searchId,
        query,
        timestamp: new Date(),
        contactsFound: contacts.length,
        contacts: contacts.map(contact => {
          const contactData: Partial<Contact> = {
            id: contact.id,
            name: contact.name,
          };
          
          // Only include defined values to avoid Firestore errors
          const typedContact = contact as Contact;
          if (typedContact.email) {
            contactData.email = typedContact.email;
          }
          if (typedContact.phone) {
            contactData.phone = typedContact.phone;
          }
          if (contact.url) {
            contactData.url = contact.url;
          }
          if (contact.summary) {
            contactData.summary = contact.summary;
          }
          
          return contactData as Contact;
        }),
        searchType: "manual",
        // Note: search history stores basic contacts only, enrichment is tracked separately
        created_at: new Date(),
      };

      await db.collection("search_history").doc(searchId).set(searchHistory);
      console.log("Search history stored successfully with ID:", searchId);
    } catch (historyError) {
      console.error("Failed to store search history:", historyError);
      // Don't fail the request if history storage fails
    }

    return res.status(200).json({
      contacts,
      total: contacts.length,
      requested: maxResults,
      method: useWebsets ? "websets" : "regular",
      batchSize,
      success: true,
      searchId, // Include search ID in response
      enrichmentNote: enrichContacts
        ? limitCheck.subscription.planId === 'trial' 
          ? "Trial users cannot access contact enrichment. Subscribe for unlimited searches and enrichment."
          : "Contact enrichment (email/phone) included - this may incur additional charges for paid plans."
        : limitCheck.subscription.planId === 'trial'
        ? "Basic search results only. Subscribe for contact enrichment."
        : "Basic search results only. Use /api/enrichContacts for email/phone enrichment.",
      subscription: {
        remainingSearches: limitCheck.remainingSearches - 1, // After this search
        searchLimit: limitCheck.subscription.searchLimit,
        planName: limitCheck.subscription.planName,
      },
    });
    // eslint-disable-next-line
  } catch (err: any) {
    console.error("Search error:", err);

    // Check if it's a usage limit error
    if (err.message?.includes("Search limit exceeded")) {
      return res.status(429).json({
        error: "Search limit exceeded",
        details: err.message,
        upgradeRequired: true,
      });
    }

    return res.status(500).json({
      error: "Search failed",
      details: err?.message || "Unknown error",
      success: false,
    });
  }
}

async function handleWebsetsSearch(
  query: string,
  maxResults: number,
  batchSize: number,
  enrichContacts: boolean = false
): Promise<BasicContact[]> {
  // Dynamic import to avoid TypeScript issues
  const { default: Exa } = await import("exa-js");
  const exa = new Exa(process.env.EXA_API_KEY);

  try {
    console.log(`Creating webset for ${maxResults} results...`);

    // eslint-disable-next-line
    const websetParams: any = {
      search: {
        query: query,
        numResults: maxResults, // Remove artificial limits
        type: "neural" as const,
        useAutoprompt: true,
        contents: {
          text: true,
          summary: true,
        },
      },
      enrichments: [
        {
          description: "Extract the email address for this business",
          format: "text" as const,
        },
        {
          description: "Extract the phone number for this business",
          format: "text" as const,
        },
      ],
    };

    const webset = await exa.websets.create(websetParams);
    console.log(`Webset created: ${webset.id}`);

    // Wait for completion with longer timeout for large datasets
    console.log("Waiting for webset to complete...");
    await exa.websets.waitUntilIdle(webset.id, {
      timeout: 300000, // 5 minutes for large datasets
      pollInterval: 10000, // Check every 10 seconds
    });

    // Get results - Exa websets don't support pagination, get all at once
    console.log("Fetching webset items...");
    const itemsResponse = await exa.websets.items.list(webset.id, {
      limit: maxResults, // Get all results in one call
    });

    console.log(`Total items fetched: ${itemsResponse.data.length}`);

    const contacts: BasicContact[] = [];

    for (let i = 0; i < itemsResponse.data.length; i++) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const item = itemsResponse.data[i] as any;

      let email: string | undefined;
      let phone: string | undefined;

      // Try to extract from enrichments
      if (item.enrichments) {
        const enrichmentEntries = Object.entries(item.enrichments);
        for (const [, value] of enrichmentEntries) {
          if (value && typeof value === "string") {
            if (isEmailLike(value)) {
              email = cleanEmail(value);
            } else if (isPhoneLike(value)) {
              phone = cleanPhone(value);
            }
          }
        }
      }

      // Fallback to text extraction
      if ((!email || !phone) && item.text) {
        const textEmails = extractEmails(item.text);
        const textPhones = extractPhones(item.text);

        email = email || textEmails[0];
        phone = phone || textPhones[0];
      }

      // Add basic contact info (enrichment is separate)
      const basicContact: BasicContact = {
        id: (i + 1).toString(),
        name: item.title || "Unknown Business",
        url: item.url,
        summary: item.summary,
      };

      // Only include email/phone if enrichContacts is true (for backward compatibility)
      if (enrichContacts && (email || phone)) {
        (basicContact as Contact).email = email;
        (basicContact as Contact).phone = phone;
      }

      contacts.push(basicContact);
    }

    return contacts;
    // eslint-disable-next-line
  } catch (error: any) {
    console.error("Websets error:", error);
    throw new Error(`Websets failed: ${error.message}`);
  }
}

async function handleRegularSearch(
  query: string,
  maxResults: number,
  batchSize: number,
  enrichContacts: boolean = false
): Promise<BasicContact[]> {
  try {
    console.log(`Starting regular search for ${maxResults} results...`);

    const allContacts: BasicContact[] = [];
    let processedResults = 0;
    let startCrawlDate: string | null = null;

    // Process in batches to handle large result sets
    while (processedResults < maxResults) {
      const remainingResults = maxResults - processedResults;
      const currentBatchSize = Math.min(remainingResults, batchSize);

      console.log(
        `Fetching batch: ${processedResults + 1}-${
          processedResults + currentBatchSize
        }`
      );

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const requestBody: any = {
        query,
        numResults: currentBatchSize,
        type: "neural",
        useAutoprompt: true,
        contents: {
          text: true,
          summary: true,
        },
      };

      // Add date filter for pagination (to get different results)
      if (startCrawlDate) {
        requestBody.startCrawlDate = startCrawlDate;
      }

      const response = await fetch("https://api.exa.ai/search", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${process.env.EXA_API_KEY}`,
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`Exa API error: ${response.status} - ${errorText}`);
        break; // Stop on API error but return what we have
      }

      const data = await response.json();
      const results = data.results || [];

      if (results.length === 0) {
        console.log("No more results available");
        break; // No more results
      }

      console.log(`Processing ${results.length} results in current batch...`);

      for (let i = 0; i < results.length; i++) {
        const result = results[i];

        const emails = extractEmails(result.text || "");
        const phones = extractPhones(result.text || "");

        // Add basic contact info (enrichment is separate)
        const basicContact: BasicContact = {
          id: (allContacts.length + 1).toString(),
          name: result.title || "Unknown Business",
          url: result.url,
          summary: result.summary,
        };

        // Only include email/phone if enrichContacts is true (for backward compatibility)
        if (enrichContacts && (emails.length > 0 || phones.length > 0)) {
          (basicContact as Contact).email = emails[0];
          (basicContact as Contact).phone = phones[0];
        }

        allContacts.push(basicContact);
      }

      processedResults += results.length;

      // Update crawl date for next batch (use oldest result's date)
      if (results.length > 0 && results[results.length - 1].publishedDate) {
        startCrawlDate = results[results.length - 1].publishedDate;
      }

      console.log(`Total contacts found so far: ${allContacts.length}`);

      // Add delay between batches to avoid rate limiting
      if (processedResults < maxResults) {
        await new Promise((resolve) => setTimeout(resolve, 2000)); // 2 second delay
      }
    }

    console.log(
      `Regular search completed. Total contacts: ${allContacts.length}`
    );
    return allContacts;
    // eslint-disable-next-line
  } catch (error: any) {
    console.error("Regular search error:", error);
    throw new Error(`Regular search failed: ${error.message}`);
  }
}

// Helper functions
function isEmailLike(text: string): boolean {
  return text.includes("@") && text.includes(".");
}

function isPhoneLike(text: string): boolean {
  const digits = text.replace(/\D/g, "");
  return digits.length >= 7 && digits.length <= 15;
}

function cleanEmail(email: string): string | undefined {
  const match = email.match(
    /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/
  );
  return match ? match[0].toLowerCase() : undefined;
}

function cleanPhone(phone: string): string | undefined {
  const cleaned = phone.replace(/[^\d+]/g, "");
  if (cleaned.length >= 7 && cleaned.length <= 15) {
    return cleaned;
  }
  return undefined;
}

function extractEmails(text: string): string[] {
  const emailRegex = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g;
  const matches = text.match(emailRegex) || [];

  return matches
    .map((email) => email.toLowerCase())
    .filter((email, index, arr) => arr.indexOf(email) === index)
    .slice(0, 3); // Limit to 3 emails max
}

// eslint-disable-next-line
function extractPhones(text: string): any[] {
  const phonePatterns = [
    /\+\d{1,4}[\s.-]?\(?[\d\s.-]{7,}\)?[\s.-]?\d/g,
    /\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}/g,
    /\b\d{10,15}\b/g,
  ];

  const foundNumbers: string[] = [];

  phonePatterns.forEach((pattern) => {
    const matches = text.match(pattern) || [];
    foundNumbers.push(...matches);
  });

  return foundNumbers
    .map((phone) => {
      const cleaned = phone.replace(/[^\d+]/g, "");
      return cleaned.length >= 7 && cleaned.length <= 15 ? cleaned : null;
    })
    .filter(Boolean)
    .filter((phone, index, arr) => arr.indexOf(phone) === index)
    .slice(0, 3); // Limit to 3 phones max
}
