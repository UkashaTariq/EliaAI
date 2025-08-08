import type { NextApiRequest, NextApiResponse } from "next";
import { db } from "../../lib/firebaseAdmin";
import { v4 as uuidv4 } from "uuid";
import type {
  ImportHistory,
  SubscriptionRecord,
} from "../../lib/firestore-schema";
import { getSession } from "../../lib/session-utils";
import { getValidAccessToken } from "../../lib/token-refresh";

interface Contact {
  name: string;
  email?: string;
  phone?: string;
  // eslint-disable-next-line
  customFields?: Record<string, any>;
}

interface CreateContactRequest {
  identifier: string;
  contacts: Contact[];
  locationId?: string;
  additionalTags?: string[]; // Optional additional tags
  searchId?: string; // ID of the search that generated these contacts
  query?: string; // Original search query
  listName?: string; // Name of the list for import
  enrichedImport?: boolean; // Flag to indicate if this is an enriched import
}

interface InstallData {
  identifier: string;
  access_token: string;
  refresh_token?: string;
  locationId?: string;
  created_at: unknown;
  updated_at: unknown;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

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
      identifier,
      contacts,
      locationId,
      additionalTags = [],
      searchId,
      query,
      listName,
      enrichedImport = false,
    } = req.body as CreateContactRequest;

    // Validate required fields
    if (!identifier) {
      return res.status(400).json({ error: "Missing identifier" });
    }

    if (!contacts || !Array.isArray(contacts) || contacts.length === 0) {
      return res.status(400).json({ error: "No contacts provided" });
    }

    // Check if this is an enriched import and user is on trial
    // if (enrichedImport) {
    //   try {
    //     const subscriptionDoc = await db.collection('subscriptions').doc(session.user.identifier).get();

    //     if (subscriptionDoc.exists) {
    //       const subscription = subscriptionDoc.data() as SubscriptionRecord;

    //       // Block enriched imports for trial users
    //       if (subscription.planId === 'trial') {
    //         return res.status(403).json({
    //           error: "Contact enrichment during import is not available during trial period",
    //           message: "Subscribe to unlock unlimited searches and contact enrichment features",
    //           upgradeRequired: true,
    //           subscription: {
    //             planName: subscription.planName,
    //             planId: subscription.planId,
    //           }
    //         });
    //       }
    //     }
    //   } catch (subscriptionError) {
    //     console.error('Error checking subscription for import:', subscriptionError);
    //     // Continue with import if subscription check fails
    //   }
    // }

    // Get valid access token (with automatic refresh if needed)
    const validAccessToken = await getValidAccessToken(identifier);
    
    if (!validAccessToken) {
      return res.status(401).json({ 
        error: "Invalid or expired access token",
        tokenExpired: true,
        message: "Please re-authenticate with GoHighLevel"
      });
    }

    // Get additional data from Firebase
    const snap = await db.collection("app_installs").doc(identifier).get();
    if (!snap.exists) {
      return res.status(404).json({ error: "Install not found" });
    }

    const tokens = snap.data() as InstallData;
    const location = locationId || tokens.locationId || identifier;

    // Generate unique import tag with timestamp
    const timestamp = Date.now();
    const importTag = `eliaai-${timestamp}`;

    // Combine import tag with any additional tags
    const allTags = [importTag, ...additionalTags];

    // Step 1: Import all contacts with the unique tag
    // eslint-disable-next-line
    const created: any[] = [];
    const errors: Array<{ contact: Contact; error: string }> = [];
    const contactIds: string[] = [];

    const batchSize = 10;
    for (let i = 0; i < contacts.length; i += batchSize) {
      const batch = contacts.slice(i, i + batchSize);

      await Promise.all(
        batch.map(async (contact) => {
          try {
            // Parse name
            const nameParts = contact.name.trim().split(" ");
            const firstName = nameParts[0] || "";
            const lastName = nameParts.slice(1).join(" ") || "";

            // Prepare contact data
            // eslint-disable-next-line
            const contactData: any = {
              firstName,
              lastName,
              name: contact.name,
              locationId: location,
              tags: allTags,
              source: "EliaAI Import",
            };

            if (contact.email) {
              contactData.email = contact.email.toLowerCase().trim();
            }

            if (contact.phone) {
              // Ensure phone is properly formatted
              let phone = contact.phone.replace(/[^\d+]/g, "");
              if (!phone.startsWith("+")) {
                phone = "+1" + phone; // Default to US if no country code
              }
              contactData.phone = phone;
            }

            // Add custom fields if provided
            if (contact.customFields) {
              contactData.customField = contact.customFields;
            }

            // Create contact
            const resp = await fetch(
              "https://services.leadconnectorhq.com/contacts/",
              {
                method: "POST",
                headers: {
                  Authorization: `Bearer ${validAccessToken}`,
                  "Content-Type": "application/json",
                  Version: "2021-07-28",
                },
                body: JSON.stringify(contactData),
              }
            );

            if (resp.ok) {
              const data = await resp.json();
              const contact = data.contact || data;
              created.push(contact);
              if (contact.id) {
                contactIds.push(contact.id);
              }
            } else {
              const errorText = await resp.text();
              console.error("Failed to create contact:", {
                status: resp.status,
                error: errorText,
              });

              // Handle duplicate contacts
              if (resp.status === 400 && errorText.includes("duplicate")) {
                // Search for existing contact
                const searchResp = await fetch(
                  `https://services.leadconnectorhq.com/contacts/search?locationId=${location}&q=${encodeURIComponent(
                    contact.email || contact.phone || ""
                  )}`,
                  {
                    headers: {
                      Authorization: `Bearer ${validAccessToken}`,
                      Version: "2021-07-28",
                    },
                  }
                );

                if (searchResp.ok) {
                  const searchData = await searchResp.json();
                  const existingContact = searchData.contacts?.[0];

                  if (existingContact) {
                    // Merge tags with existing ones
                    const existingTags = existingContact.tags || [];
                    const newTags = [...new Set([...existingTags, ...allTags])];

                    const updateResp = await fetch(
                      `https://services.leadconnectorhq.com/contacts/${existingContact.id}`,
                      {
                        method: "PUT",
                        headers: {
                          Authorization: `Bearer ${validAccessToken}`,
                          "Content-Type": "application/json",
                          Version: "2021-07-28",
                        },
                        body: JSON.stringify({
                          tags: newTags,
                        }),
                      }
                    );

                    if (updateResp.ok) {
                      const updateData = await updateResp.json();
                      const updatedContact = updateData.contact || updateData;
                      created.push(updatedContact);
                      if (updatedContact.id) {
                        contactIds.push(updatedContact.id);
                      }
                    }
                  }
                }
              } else {
                errors.push({
                  contact,
                  error: `HTTP ${resp.status}: ${errorText}`,
                });
              }
            }
          } catch (error) {
            console.error("Error processing contact:", error);
            errors.push({
              contact,
              error: error instanceof Error ? error.message : "Unknown error",
            });
          }
        })
      );

      if (i + batchSize < contacts.length) {
        await new Promise((resolve) => setTimeout(resolve, 500));
      }
    }

    // Step 2: Store import metadata in Firebase
    const importData = {
      importTag,
      timestamp: new Date(timestamp),
      totalContacts: contacts.length,
      successCount: created.length,
      errorCount: errors.length,
      contactIds,
      locationId: location,
      additionalTags,
    };

    await db
      .collection("app_installs")
      .doc(identifier)
      .collection("imports")
      .doc(importTag)
      .set(importData);

    // Update last activity timestamp
    await db.collection("app_installs").doc(identifier).update({
      updated_at: new Date(),
      last_import: new Date(),
      last_import_tag: importTag,
    });

    // Step 3: Create a smart list for this import
    let smartListId: string | null = null;
    let smartListError: string | null = null;

    if (created.length > 0) {
      try {
        // Generate a readable name for the smart list
        const date = new Date(timestamp);
        const formattedDate = date.toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
          year: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        });
        const smartListName = `Import - ${formattedDate}`;

        // Create the smart list using the correct API endpoint
        const smartListResp = await fetch(
          `https://services.leadconnectorhq.com/locations/${location}/smartLists`,
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${tokens.access_token}`,
              "Content-Type": "application/json",
              Version: "2021-07-28",
            },
            body: JSON.stringify({
              name: smartListName,
              filters: [
                [
                  {
                    field: "tags",
                    operator: "in",
                    value: [importTag],
                  },
                ],
              ],
            }),
          }
        );

        if (smartListResp.ok) {
          const smartListData = await smartListResp.json();
          smartListId = smartListData.id || smartListData.smartList?.id;
          console.log("Smart list created successfully:", smartListId);
        } else {
          const errorText = await smartListResp.text();
          console.error("Failed to create smart list:", errorText);
          smartListError = errorText;

          // Try alternative endpoint structure
          const altResp = await fetch(
            `https://services.leadconnectorhq.com/contacts/smart-list`,
            {
              method: "POST",
              headers: {
                Authorization: `Bearer ${tokens.access_token}`,
                "Content-Type": "application/json",
                Version: "2021-07-28",
              },
              body: JSON.stringify({
                locationId: location,
                name: smartListName,
                filters: {
                  groups: [
                    {
                      filters: [
                        {
                          field: "tags",
                          operator: "contains",
                          value: importTag,
                        },
                      ],
                    },
                  ],
                },
              }),
            }
          );

          if (altResp.ok) {
            const altData = await altResp.json();
            smartListId = altData.id || altData.smartList?.id;
            smartListError = null;
            console.log(
              "Smart list created with alternative endpoint:",
              smartListId
            );
          }
        }
      } catch (error) {
        console.error("Error creating smart list:", error);
        smartListError =
          error instanceof Error ? error.message : "Unknown error";
      }
    }

    // Store import history
    if (created.length > 0 && searchId && query) {
      try {
        const importId = uuidv4();
        const importHistory: ImportHistory = {
          identifier,
          locationId: location,
          importId,
          searchId,
          query,
          listName: listName || "Imported Contacts",
          contactsImported: created.length,
          contacts: created.map((contact) => ({
            id: contact.id,
            name: contact.name || contact.firstName + " " + contact.lastName,
            email: contact.email,
            phone: contact.phone,
            url: contact.website || contact.customField?.website,
            summary: contact.notes || contact.customField?.notes,
          })),
          timestamp: new Date(),
          ghlResponse: {
            created: created.length,
            errors: errors.length,
            smartListId,
          },
          created_at: new Date(),
        };

        await db.collection("import_history").doc(importId).set(importHistory);
      } catch (historyError) {
        console.error("Failed to store import history:", historyError);
        // Don't fail the request if history storage fails
      }
    }

    // Return response
    res.status(200).json({
      success: true,
      importTag,
      timestamp,
      importDate: new Date(timestamp).toISOString(),
      totalContacts: contacts.length,
      created: created.length,
      failed: errors.length,
      tags: allTags,
      smartListId,
      smartListError,
      message: smartListId
        ? `Contacts imported and smart list created successfully!`
        : `Contacts imported successfully with tag "${importTag}".${
            smartListError
              ? " Smart list creation failed - you may need to create it manually."
              : ""
          }`,
      contacts: created,
      errors: errors.length > 0 ? errors : undefined,
      enrichmentNote: enrichedImport
        ? "Enriched contact import completed - this may incur additional charges for paid plans."
        : "Basic contact import completed. Use enriched import for email/phone data.",
    });
  } catch (error) {
    console.error("Handler error:", error);
    res.status(500).json({
      error: "Internal server error",
      message: error instanceof Error ? error.message : "Unknown error",
    });
  }
}

// Helper endpoint to create smart list for existing tags
export async function createSmartListForTags(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { identifier, smartListName, tags, locationId } = req.body as {
      identifier: string;
      smartListName: string;
      tags: string[];
      locationId?: string;
    };

    if (!identifier || !smartListName || !tags || tags.length === 0) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    // Get access token
    const snap = await db.collection("app_installs").doc(identifier).get();
    if (!snap.exists) {
      return res.status(404).json({ error: "Install not found" });
    }

    const tokens = snap.data() as InstallData;
    const location = locationId || tokens.locationId || identifier;

    // Try to create smart list via API
    const smartListResp = await fetch(
      "https://services.leadconnectorhq.com/contacts/smart-lists",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${tokens.access_token}`,
          "Content-Type": "application/json",
          Version: "2021-07-28",
        },
        body: JSON.stringify({
          name: smartListName,
          locationId: location,
          filters: tags.map((tag) => ({
            field: "tags",
            operator: "contains",
            value: tag,
          })),
          filterOperator: "OR", // Contacts with ANY of the specified tags
        }),
      }
    );

    if (smartListResp.ok) {
      const data = await smartListResp.json();
      res.status(200).json({
        success: true,
        smartList: data,
        message: `Smart list "${smartListName}" created successfully.`,
      });
    } else {
      const errorText = await smartListResp.text();
      console.error("Smart list creation failed:", errorText);

      res.status(200).json({
        success: false,
        message:
          "Smart list creation via API not supported. Please create manually in GHL.",
        instructions: [
          "1. Go to Contacts → Smart Lists → Manage Smart Lists",
          '2. Click "+ Add Smart List"',
          `3. Name it: "${smartListName}"`,
          `4. Add filters for tags: ${tags.join(", ")}`,
          "5. Save the smart list",
        ],
      });
    }
  } catch (error) {
    console.error("Error creating smart list:", error);
    res.status(500).json({
      error: "Internal server error",
      message: error instanceof Error ? error.message : "Unknown error",
    });
  }
}
