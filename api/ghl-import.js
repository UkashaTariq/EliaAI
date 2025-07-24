// api/ghl-import.js - GoHighLevel Contact Import Handler

export default async function handler(req, res) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { contacts, smartListName, accessToken, locationId } = req.body;

    if (!contacts || !Array.isArray(contacts) || contacts.length === 0) {
      return res.status(400).json({ error: 'Contacts array is required' });
    }

    if (!smartListName || smartListName.trim().length === 0) {
      return res.status(400).json({ error: 'Smart list name is required' });
    }

    if (!accessToken) {
      return res.status(401).json({ error: 'Access token is required' });
    }

    // Step 1: Create smart list tag
    let smartListTag;
    try {
      const tagResponse = await fetch(`${process.env.GHL_API_URL}/contacts/tags`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
          'Version': '2021-07-28'
        },
        body: JSON.stringify({
          locationId: locationId,
          name: smartListName,
          color: '#3b82f6'
        })
      });

      if (tagResponse.ok) {
        smartListTag = await tagResponse.json();
      } else {
        // Tag might already exist, continue with import
        console.log('Tag creation failed, might already exist:', await tagResponse.text());
      }
    } catch (tagError) {
      console.error('Tag creation error:', tagError);
      // Continue with import even if tag creation fails
    }

    // Step 2: Import contacts
    const importResults = [];
    const importErrors = [];

    for (let i = 0; i < contacts.length; i++) {
      const contact = contacts[i];
      
      try {
        // Prepare contact data
        const contactData = {
          firstName: extractFirstName(contact.name),
          lastName: extractLastName(contact.name),
          name: contact.name,
          email: contact.email || undefined,
          phone: contact.phone || undefined,
          address1: contact.address || undefined,
          website: contact.website || undefined,
          companyName: contact.name,
          locationId: locationId,
          tags: [smartListName, 'EXA_IMPORT'],
          source: 'EXA_AI_IMPORT',
          customFields: [
            {
              key: 'business_category',
              field_value: contact.category || 'Business'
            },
            {
              key: 'rating',
              field_value: contact.rating?.toString() || '0'
            },
            {
              key: 'description',
              field_value: contact.description || ''
            },
            {
              key: 'import_source',
              field_value: 'EXA_AI'
            },
            {
              key: 'import_date',
              field_value: new Date().toISOString().split('T')[0]
            }
          ].filter(field => field.field_value) // Remove empty fields
        };

        // Remove undefined fields
        Object.keys(contactData).forEach(key => {
          if (contactData[key] === undefined) {
            delete contactData[key];
          }
        });

        const contactResponse = await fetch(`${process.env.GHL_API_URL}/contacts/`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
            'Version': '2021-07-28'
          },
          body: JSON.stringify(contactData)
        });

        if (contactResponse.ok) {
          const createdContact = await contactResponse.json();
          importResults.push({
            originalContact: contact,
            ghlContact: createdContact,
            status: 'success'
          });
        } else {
          const errorData = await contactResponse.json();
          
          // Check if contact already exists
          if (contactResponse.status === 409 || errorData.message?.includes('already exists')) {
            importResults.push({
              originalContact: contact,
              status: 'skipped',
              reason: 'Contact already exists'
            });
          } else {
            importErrors.push({
              contact: contact,
              error: errorData.message || 'Unknown error',
              status: contactResponse.status
            });
          }
        }

        // Add small delay to avoid rate limiting
        if (i < contacts.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }

      } catch (contactError) {
        console.error(`Error importing contact ${contact.name}:`, contactError);
        importErrors.push({
          contact: contact,
          error: contactError.message,
          status: 'exception'
        });
      }
    }

    // Step 3: Return results
    const response = {
      success: true,
      smartListName: smartListName,
      totalContacts: contacts.length,
      successfulImports: importResults.filter(r => r.status === 'success').length,
      skippedContacts: importResults.filter(r => r.status === 'skipped').length,
      failedImports: importErrors.length,
      results: importResults,
      errors: importErrors
    };

    // Log summary
    console.log(`Import Summary for "${smartListName}":`, {
      total: response.totalContacts,
      successful: response.successfulImports,
      skipped: response.skippedContacts,
      failed: response.failedImports
    });

    return res.status(200).json(response);

  } catch (error) {
    console.error('Import handler error:', error);
    return res.status(500).json({ 
      error: 'Import failed', 
      message: error.message,
      details: error.stack
    });
  }
}

// Helper functions
function extractFirstName(fullName) {
  if (!fullName) return '';
  const parts = fullName.trim().split(' ');
  return parts[0] || '';
}

function extractLastName(fullName) {
  if (!fullName) return '';
  const parts = fullName.trim().split(' ');
  return parts.length > 1 ? parts.slice(1).join(' ') : '';
}

// Validate contact data before import
function validateContact(contact) {
  const errors = [];

  if (!contact.name || contact.name.trim().length === 0) {
    errors.push('Contact name is required');
  }

  if (contact.email && !isValidEmail(contact.email)) {
    errors.push('Invalid email format');
  }

  if (contact.phone && !isValidPhone(contact.phone)) {
    errors.push('Invalid phone format');
  }

  return {
    isValid: errors.length === 0,
    errors: errors
  };
}

function isValidEmail(email) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

function isValidPhone(phone) {
  const phoneRegex = /^[\+]?[1-9][\d]{0,15}$/;
  const cleanPhone = phone.replace(/[\s\-\(\)]/g, '');
  return phoneRegex.test(cleanPhone);
}