import type { NextApiRequest, NextApiResponse } from "next";

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

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "POST") return res.status(405).end();

  const {
    query,
    maxResults = 100,
    useWebsets = false,
    batchSize = 100,
  } = req.body as {
    query?: string;
    maxResults?: number;
    useWebsets?: boolean;
    batchSize?: number;
  };

  if (!query) return res.status(400).json({ error: "Missing query" });

  try {
    let contacts: Contact[] = [];

    if (useWebsets) {
      // Use Exa Websets approach with batching for large results
      contacts = await handleWebsetsSearch(query, maxResults, batchSize);
    } else {
      // Use regular Exa search with batching
      contacts = await handleRegularSearch(query, maxResults, batchSize);
    }

    return res.status(200).json({
      contacts,
      total: contacts.length,
      requested: maxResults,
      method: useWebsets ? "websets" : "regular",
      batchSize,
      success: true,
    });
    // eslint-disable-next-line
  } catch (err: any) {
    console.error("Search error:", err);
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
  batchSize: number
): Promise<Contact[]> {
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

    const contacts: Contact[] = [];

    for (let i = 0; i < itemsResponse.data.length; i++) {
      // eslint-disable-next-line
      const item: any = itemsResponse.data[i];

      let email: string | undefined;
      let phone: string | undefined;

      // Try to extract from enrichments
      if (item.enrichments) {
        const enrichmentEntries = Object.entries(item.enrichments);
        for (const [key, value] of enrichmentEntries) {
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

      // Only add if we have contact info
      if (email || phone) {
        contacts.push({
          id: (i + 1).toString(),
          name: item.title || "Unknown Business",
          email,
          phone,
          url: item.url,
          summary: item.summary,
        });
      }
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
  batchSize: number
): Promise<Contact[]> {
  try {
    console.log(`Starting regular search for ${maxResults} results...`);

    const allContacts: Contact[] = [];
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

      // eslint-disable-next-line
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

        // Only add if we have contact info
        if (emails.length > 0 || phones.length > 0) {
          allContacts.push({
            id: (allContacts.length + 1).toString(),
            name: result.title || "Unknown Business",
            email: emails[0],
            phone: phones[0],
            url: result.url,
            summary: result.summary,
          });
        }
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
