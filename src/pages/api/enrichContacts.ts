import type { NextApiRequest, NextApiResponse } from "next";
import { getSession } from "../../lib/session-utils";
import { getEnrichmentQuote, recordEnrichmentUsage, canUserEnrich } from "../../lib/enrichment-billing";
import type { Contact } from "../../lib/firestore-schema";

interface EnrichContactsRequest {
  contacts: Array<{
    id: string;
    name: string;
    url?: string;
    summary?: string;
  }>;
  enrichmentTypes?: string[]; // ['email', 'phone', 'insights']
  searchId?: string;
}

interface EnrichedContact extends Contact {
  enrichmentTypes: string[];
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
        requiresAuth: true 
      });
    }

    const {
      contacts,
      enrichmentTypes = ['email', 'phone', 'insights'],
      searchId,
    } = req.body as EnrichContactsRequest;

    if (!contacts || !Array.isArray(contacts) || contacts.length === 0) {
      return res.status(400).json({ error: "No contacts provided for enrichment" });
    }

    // Check if user can perform enrichment
    const eligibilityCheck = await canUserEnrich(session.user.identifier);
    
    if (!eligibilityCheck.canEnrich) {
      return res.status(403).json({
        error: "Enrichment not available",
        reason: eligibilityCheck.reason,
        upgradeRequired: true,
        plan: eligibilityCheck.plan
      });
    }

    // Get enrichment quote
    const quote = await getEnrichmentQuote(
      session.user.identifier,
      contacts.length,
      {
        includeEmail: enrichmentTypes.includes('email'),
        includePhone: enrichmentTypes.includes('phone'),
        includeInsights: enrichmentTypes.includes('insights'),
      }
    );

    if (!quote.canAfford) {
      return res.status(403).json({
        error: "Cannot afford enrichment",
        quote,
        upgradeRequired: !quote.subscription.isWhiteLabel
      });
    }

    // Perform enrichment using Exa API
    const enrichedContacts: EnrichedContact[] = [];
    let successfulEnrichments = 0;

    for (const contact of contacts) {
      try {
        // Use Exa search to find contact details
        const enrichedData = await enrichContactWithExa(contact, enrichmentTypes);
        enrichedContacts.push(enrichedData);
        
        if (enrichedData.email || enrichedData.phone) {
          successfulEnrichments++;
        }
      } catch (error) {
        console.error(`Failed to enrich contact ${contact.id}:`, error);
        // Add contact without enrichment
        enrichedContacts.push({
          ...contact,
          enrichmentTypes: [],
        });
      }
    }

    // Record enrichment usage for successful enrichments only
    if (successfulEnrichments > 0) {
      await recordEnrichmentUsage(
        session.user.identifier,
        session.user.locationId,
        successfulEnrichments,
        enrichmentTypes,
        searchId
      );
    }

    return res.status(200).json({
      success: true,
      enrichedContacts,
      totalContacts: contacts.length,
      successfulEnrichments,
      failedEnrichments: contacts.length - successfulEnrichments,
      costPerContact: quote.costPerContact,
      totalCost: quote.costPerContact * successfulEnrichments,
      subscription: {
        planName: quote.subscription.planName,
        enrichmentsUsed: quote.subscription.enrichmentsUsed + successfulEnrichments,
        enrichmentCostAccrued: quote.subscription.enrichmentCostAccrued + (quote.costPerContact * successfulEnrichments),
      }
    });

  } catch (error) {
    console.error("Enrichment error:", error);
    return res.status(500).json({
      error: "Enrichment failed",
      details: error instanceof Error ? error.message : "Unknown error",
    });
  }
}

async function enrichContactWithExa(
  contact: { id: string; name: string; url?: string; summary?: string },
  enrichmentTypes: string[]
): Promise<EnrichedContact> {
  try {
    // If we have a URL, use it for targeted enrichment
    if (contact.url) {
      const { default: Exa } = await import("exa-js");
      const exa = new Exa(process.env.EXA_API_KEY);

      // Get page content for the contact's URL
      const contentResponse = await exa.getContents([contact.url], {
        text: true,
        summary: true,
      });

      if (contentResponse.results.length > 0) {
        const content = contentResponse.results[0];
        const text = content.text || "";

        const enrichedContact: EnrichedContact = {
          id: contact.id,
          name: contact.name,
          url: contact.url,
          summary: content.summary || contact.summary,
          enrichmentTypes: [],
        };

        // Extract email if requested
        if (enrichmentTypes.includes('email')) {
          const emails = extractEmails(text);
          if (emails.length > 0) {
            enrichedContact.email = emails[0];
            enrichedContact.enrichmentTypes.push('email');
          }
        }

        // Extract phone if requested
        if (enrichmentTypes.includes('phone')) {
          const phones = extractPhones(text);
          if (phones.length > 0) {
            enrichedContact.phone = phones[0];
            enrichedContact.enrichmentTypes.push('phone');
          }
        }

        // Add insights if requested
        if (enrichmentTypes.includes('insights') && content.summary) {
          enrichedContact.enrichmentTypes.push('insights');
        }

        return enrichedContact;
      }
    }

    // Fallback: search for the business name
    const { default: Exa } = await import("exa-js");
    const exa = new Exa(process.env.EXA_API_KEY);

    const searchQuery = `${contact.name} contact information email phone`;
    const searchResponse = await exa.searchAndContents(searchQuery, {
      type: "neural",
      numResults: 1,
      text: true,
      summary: true,
    });

    if (searchResponse.results.length > 0) {
      const result = searchResponse.results[0];
      const text = result.text || "";

      const enrichedContact: EnrichedContact = {
        id: contact.id,
        name: contact.name,
        url: result.url || contact.url,
        summary: result.summary || contact.summary,
        enrichmentTypes: [],
      };

      // Extract email if requested
      if (enrichmentTypes.includes('email')) {
        const emails = extractEmails(text);
        if (emails.length > 0) {
          enrichedContact.email = emails[0];
          enrichedContact.enrichmentTypes.push('email');
        }
      }

      // Extract phone if requested
      if (enrichmentTypes.includes('phone')) {
        const phones = extractPhones(text);
        if (phones.length > 0) {
          enrichedContact.phone = phones[0];
          enrichedContact.enrichmentTypes.push('phone');
        }
      }

      // Add insights if requested
      if (enrichmentTypes.includes('insights') && result.summary) {
        enrichedContact.enrichmentTypes.push('insights');
      }

      return enrichedContact;
    }

    // Return contact without enrichment if no data found
    return {
      ...contact,
      enrichmentTypes: [],
    };

  } catch (error) {
    console.error("Exa enrichment error:", error);
    return {
      ...contact,
      enrichmentTypes: [],
    };
  }
}

// Helper functions
function extractEmails(text: string): string[] {
  const emailRegex = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g;
  const matches = text.match(emailRegex) || [];

  return matches
    .map((email) => email.toLowerCase())
    .filter((email, index, arr) => arr.indexOf(email) === index)
    .slice(0, 3); // Limit to 3 emails max
}

function extractPhones(text: string): string[] {
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
    .slice(0, 3) as string[]; // Limit to 3 phones max
}