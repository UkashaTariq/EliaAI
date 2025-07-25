// import type { NextApiRequest, NextApiResponse } from 'next';
// import { db } from '../../lib/firebaseAdmin';

// export default async function handler(req: NextApiRequest, res: NextApiResponse) {
//   if (req.method !== 'POST') return res.status(405).end();

//   const { identifier, contacts, listName } = req.body as {
//     identifier: string;
//     contacts: Array<{ name: string; email?: string; phone?: string }>;
//     listName: string;
//   };

//   if (!identifier) return res.status(400).send('Missing identifier');

//   const snap = await db.collection('app_installs').doc(identifier).get();
//   if (!snap.exists) return res.status(404).send('Install not found');
//   interface InstallData {
//     identifier: string;
//     access_token: string;
//     refresh_token?: string;
//     created_at: unknown;
//     updated_at: unknown;
//   }
//   const tokens = snap.data() as InstallData;

//   const created: Record<string, unknown>[] = [];
//   for (const contact of contacts) {
//     const resp = await fetch(
//       `https://services.leadconnectorhq.com/locations/${identifier}/contacts/`,
//       {
//         method: 'POST',
//         headers: {
//           Authorization: `Bearer ${tokens.access_token}`,
//           'Content-Type': 'application/json',
//         },
//         body: JSON.stringify({
//           ...contact,
//           source: listName,
//         }),
//       }
//     );
//     if (resp.ok) {
//       const data = await resp.json();
//       created.push(data);
//     } else {
//       const error = await resp.text();
//       console.error('Failed to create contact', error);
//     }
//   }

//   await db.collection('app_installs').doc(identifier).update({ updated_at: new Date() });

//   res.status(200).json({ created });
// }

import type { NextApiRequest, NextApiResponse } from "next";
import { db } from "../../lib/firebaseAdmin";

interface Contact {
  name: string;
  email?: string;
  phone?: string;
  customFields?: Record<string, any>;
}

interface CreateContactRequest {
  identifier: string;
  contacts: Contact[];
  listName: string;
  locationId?: string;
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
    const { identifier, contacts, listName, locationId } =
      req.body as CreateContactRequest;

    // Validate required fields
    if (!identifier) {
      return res.status(400).json({ error: "Missing identifier" });
    }

    if (!contacts || !Array.isArray(contacts) || contacts.length === 0) {
      return res.status(400).json({ error: "No contacts provided" });
    }

    if (!listName) {
      return res.status(400).json({ error: "Missing list name" });
    }

    // Get access token from Firebase
    const snap = await db.collection("app_installs").doc(identifier).get();
    if (!snap.exists) {
      return res.status(404).json({ error: "Install not found" });
    }

    const tokens = snap.data() as InstallData;
    const location = locationId || tokens.locationId || identifier;

    // Create a unique tag for this smart list
    const smartListTag = listName; // Use the exact list name as tag

    // Step 1: First create all contacts with the tag
    const created: any[] = [];
    const errors: Array<{ contact: Contact; error: string }> = [];

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
            const contactData: any = {
              firstName,
              lastName,
              name: contact.name,
              locationId: location,
              tags: [smartListTag], // Use the list name directly as tag
              source: "Smart List Import",
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
                  Authorization: `Bearer ${tokens.access_token}`,
                  "Content-Type": "application/json",
                  Version: "2021-07-28",
                },
                body: JSON.stringify(contactData),
              }
            );

            if (resp.ok) {
              const data = await resp.json();
              created.push(data.contact || data);
            } else {
              const errorText = await resp.text();
              console.error("Failed to create contact:", {
                status: resp.status,
                error: errorText,
              });

              // Handle duplicate contacts by updating their tags
              if (resp.status === 400 && errorText.includes("duplicate")) {
                const searchResp = await fetch(
                  `https://services.leadconnectorhq.com/contacts/search?locationId=${location}&q=${encodeURIComponent(
                    contact.email || contact.phone || ""
                  )}`,
                  {
                    headers: {
                      Authorization: `Bearer ${tokens.access_token}`,
                      Version: "2021-07-28",
                    },
                  }
                );

                if (searchResp.ok) {
                  const searchData = await searchResp.json();
                  const existingContact = searchData.contacts?.[0];

                  if (existingContact) {
                    // Add tag to existing contact
                    const existingTags = existingContact.tags || [];
                    if (!existingTags.includes(smartListTag)) {
                      const updateResp = await fetch(
                        `https://services.leadconnectorhq.com/contacts/${existingContact.id}`,
                        {
                          method: "PUT",
                          headers: {
                            Authorization: `Bearer ${tokens.access_token}`,
                            "Content-Type": "application/json",
                            Version: "2021-07-28",
                          },
                          body: JSON.stringify({
                            tags: [...existingTags, smartListTag],
                          }),
                        }
                      );

                      if (updateResp.ok) {
                        const updateData = await updateResp.json();
                        created.push(updateData.contact || updateData);
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

    // Step 2: Create the smart list (saved search) if needed
    let smartListId: string | null = null;
    try {
      // Check if smart list exists
      const getListsResp = await fetch(
        `https://services.leadconnectorhq.com/contacts/smart-lists?locationId=${location}`,
        {
          method: "GET",
          headers: {
            Authorization: `Bearer ${tokens.access_token}`,
            Version: "2021-07-28",
          },
        }
      );

      if (getListsResp.ok) {
        const listsData = await getListsResp.json();
        const existingList = listsData.smartLists?.find(
          (list: any) => list.name === listName
        );

        if (existingList) {
          smartListId = existingList.id;
        }
      }

      // Create smart list if it doesn't exist
      if (!smartListId) {
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
              name: listName,
              locationId: location,
              // Define the filter to show contacts with this specific tag
              filters: [
                {
                  field: "tags",
                  operator: "contains",
                  value: smartListTag,
                },
              ],
            }),
          }
        );

        if (smartListResp.ok) {
          const smartListData = await smartListResp.json();
          smartListId = smartListData.smartList?.id || smartListData.id;
          console.log("Smart list created:", smartListId);
        } else {
          const errorText = await smartListResp.text();
          console.error("Failed to create smart list:", errorText);

          // If API doesn't support creating smart lists, provide manual instructions
          if (smartListResp.status === 404 || smartListResp.status === 405) {
            console.log(
              "Smart list creation via API not supported. Manual creation required."
            );
          }
        }
      }
    } catch (error) {
      console.error("Error creating smart list:", error);
    }

    // Update last activity timestamp
    await db.collection("app_installs").doc(identifier).update({
      updated_at: new Date(),
      last_sync: new Date(),
    });

    // Return response
    res.status(200).json({
      success: true,
      listName,
      tag: smartListTag,
      totalContacts: contacts.length,
      created: created.length,
      failed: errors.length,
      smartListId,
      instructions: smartListId
        ? `Contacts have been added to the "${listName}" smart list. They are tagged with "${smartListTag}".`
        : `Contacts have been tagged with "${smartListTag}". To see them in a smart list, go to Contacts > Smart Lists > Create New Smart List and add a filter for "Tags contains ${smartListTag}"`,
      contacts: created,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error) {
    console.error("Handler error:", error);
    res.status(500).json({
      error: "Internal server error",
      message: error instanceof Error ? error.message : "Unknown error",
    });
  }
}

// import type { NextApiRequest, NextApiResponse } from "next";
// import { db } from "../../lib/firebaseAdmin";

// interface Contact {
//   name: string;
//   email?: string;
//   phone?: string;
//   customFields?: Record<string, any>;
// }

// interface CreateContactRequest {
//   identifier: string;
//   contacts: Contact[];
//   listName: string;
//   locationId?: string;
// }

// interface InstallData {
//   identifier: string;
//   access_token: string;
//   refresh_token?: string;
//   locationId?: string;
//   created_at: unknown;
//   updated_at: unknown;
// }

// export default async function handler(
//   req: NextApiRequest,
//   res: NextApiResponse
// ) {
//   if (req.method !== "POST") {
//     return res.status(405).json({ error: "Method not allowed" });
//   }

//   try {
//     const { identifier, contacts, listName, locationId } =
//       req.body as CreateContactRequest;

//     // Validate required fields
//     if (!identifier) {
//       return res.status(400).json({ error: "Missing identifier" });
//     }

//     if (!contacts || !Array.isArray(contacts) || contacts.length === 0) {
//       return res.status(400).json({ error: "No contacts provided" });
//     }

//     if (!listName) {
//       return res.status(400).json({ error: "Missing list name" });
//     }

//     // Get access token from Firebase
//     const snap = await db.collection("app_installs").doc(identifier).get();
//     if (!snap.exists) {
//       return res.status(404).json({ error: "Install not found" });
//     }

//     const tokens = snap.data() as InstallData;
//     const location = locationId || tokens.locationId || identifier;

//     // Step 1: Check if smart list already exists
//     let smartListId: string | null = null;
//     try {
//       // Get all smart lists for the location
//       const getListsResp = await fetch(
//         `https://services.leadconnectorhq.com/contacts/smart-lists?locationId=${location}`,
//         {
//           method: "GET",
//           headers: {
//             Authorization: `Bearer ${tokens.access_token}`,
//             Version: "2021-07-28",
//           },
//         }
//       );

//       if (getListsResp.ok) {
//         const listsData = await getListsResp.json();
//         const existingList = listsData.smartLists?.find(
//           (list: any) => list.name === listName
//         );

//         if (existingList) {
//           smartListId = existingList.id;
//           console.log("Found existing smart list:", smartListId);
//         }
//       }

//       // Create new smart list if it doesn't exist
//       if (!smartListId) {
//         const smartListResp = await fetch(
//           "https://services.leadconnectorhq.com/contacts/smart-lists",
//           {
//             method: "POST",
//             headers: {
//               Authorization: `Bearer ${tokens.access_token}`,
//               "Content-Type": "application/json",
//               Version: "2021-07-28",
//             },
//             body: JSON.stringify({
//               name: listName,
//               locationId: location,
//               // The smart list needs filter conditions to work properly
//               filterGroups: [
//                 {
//                   filters: [
//                     {
//                       field: "contact.tag",
//                       operator: "contains",
//                       value: `smart-list-${listName
//                         .toLowerCase()
//                         .replace(/\s+/g, "-")}`,
//                     },
//                   ],
//                 },
//               ],
//             }),
//           }
//         );

//         if (smartListResp.ok) {
//           const smartListData = await smartListResp.json();
//           smartListId = smartListData.smartList?.id || smartListData.id;
//           console.log("Smart list created:", smartListId);
//         } else {
//           const errorText = await smartListResp.text();
//           console.error("Failed to create smart list:", errorText);
//         }
//       }
//     } catch (error) {
//       console.error("Error managing smart list:", error);
//     }

//     // Step 2: Create contacts with the appropriate tag
//     const created: any[] = [];
//     const errors: Array<{ contact: Contact; error: string }> = [];
//     const tagForSmartList = `smart-list-${listName
//       .toLowerCase()
//       .replace(/\s+/g, "-")}`;

//     const batchSize = 10;
//     for (let i = 0; i < contacts.length; i += batchSize) {
//       const batch = contacts.slice(i, i + batchSize);

//       await Promise.all(
//         batch.map(async (contact) => {
//           try {
//             // Parse name
//             const nameParts = contact.name.trim().split(" ");
//             const firstName = nameParts[0] || "";
//             const lastName = nameParts.slice(1).join(" ") || "";

//             // Prepare contact data with required fields
//             const contactData: any = {
//               firstName,
//               lastName,
//               name: contact.name,
//               locationId: location,
//               tags: [tagForSmartList], // This tag will match the smart list filter
//               source: listName, // Track the source
//             };

//             if (contact.email) {
//               contactData.email = contact.email.toLowerCase().trim();
//             }

//             if (contact.phone) {
//               // Ensure phone is properly formatted
//               let phone = contact.phone.replace(/[^\d+]/g, "");
//               if (!phone.startsWith("+")) {
//                 phone = "+1" + phone; // Default to US if no country code
//               }
//               contactData.phone = phone;
//             }

//             // Add custom fields if provided
//             if (contact.customFields) {
//               contactData.customField = contact.customFields;
//             }

//             // Create contact using the correct endpoint
//             const resp = await fetch(
//               "https://services.leadconnectorhq.com/contacts/",
//               {
//                 method: "POST",
//                 headers: {
//                   Authorization: `Bearer ${tokens.access_token}`,
//                   "Content-Type": "application/json",
//                   Version: "2021-07-28",
//                 },
//                 body: JSON.stringify(contactData),
//               }
//             );

//             if (resp.ok) {
//               const data = await resp.json();
//               created.push(data.contact || data);
//             } else {
//               const errorText = await resp.text();
//               console.error("Failed to create contact:", {
//                 status: resp.status,
//                 error: errorText,
//                 contactData,
//               });

//               // Check if it's a duplicate contact error
//               if (resp.status === 400 && errorText.includes("duplicate")) {
//                 // Try to update existing contact with tag
//                 const searchResp = await fetch(
//                   `https://services.leadconnectorhq.com/contacts/search?locationId=${location}&q=${encodeURIComponent(
//                     contact.email || contact.phone || ""
//                   )}`,
//                   {
//                     headers: {
//                       Authorization: `Bearer ${tokens.access_token}`,
//                       Version: "2021-07-28",
//                     },
//                   }
//                 );

//                 if (searchResp.ok) {
//                   const searchData = await searchResp.json();
//                   const existingContact = searchData.contacts?.[0];

//                   if (existingContact) {
//                     // Update existing contact with tag
//                     const updateResp = await fetch(
//                       `https://services.leadconnectorhq.com/contacts/${existingContact.id}`,
//                       {
//                         method: "PUT",
//                         headers: {
//                           Authorization: `Bearer ${tokens.access_token}`,
//                           "Content-Type": "application/json",
//                           Version: "2021-07-28",
//                         },
//                         body: JSON.stringify({
//                           tags: [
//                             ...(existingContact.tags || []),
//                             tagForSmartList,
//                           ],
//                         }),
//                       }
//                     );

//                     if (updateResp.ok) {
//                       const updateData = await updateResp.json();
//                       created.push(updateData.contact || updateData);
//                     }
//                   }
//                 }
//               } else {
//                 errors.push({
//                   contact,
//                   error: `HTTP ${resp.status}: ${errorText}`,
//                 });
//               }
//             }
//           } catch (error) {
//             console.error("Error processing contact:", error);
//             errors.push({
//               contact,
//               error: error instanceof Error ? error.message : "Unknown error",
//             });
//           }
//         })
//       );

//       if (i + batchSize < contacts.length) {
//         await new Promise((resolve) => setTimeout(resolve, 500));
//       }
//     }

//     // Update last activity timestamp
//     await db.collection("app_installs").doc(identifier).update({
//       updated_at: new Date(),
//       last_sync: new Date(),
//     });

//     // Return response
//     res.status(200).json({
//       success: true,
//       smartListId,
//       listName,
//       tag: tagForSmartList,
//       totalContacts: contacts.length,
//       created: created.length,
//       failed: errors.length,
//       message: `Contacts have been tagged with "${tagForSmartList}". They will appear in the "${listName}" smart list.`,
//       contacts: created,
//       errors: errors.length > 0 ? errors : undefined,
//     });
//   } catch (error) {
//     console.error("Handler error:", error);
//     res.status(500).json({
//       error: "Internal server error",
//       message: error instanceof Error ? error.message : "Unknown error",
//     });
//   }
// }
