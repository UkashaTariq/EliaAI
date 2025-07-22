export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { contacts, smartListName, accessToken, locationId } = req.body;

    if (!contacts || !Array.isArray(contacts) || contacts.length === 0) {
      return res.status(400).json({ error: 'Contacts array is required' });
    }

    if (!smartListName || !accessToken || !locationId) {
      return res.status(400).json({ error: 'Missing required parameters' });
    }

    const results = [];

    // Import each contact to GHL
    for (let i = 0; i < contacts.length; i++) {
      const contact = contacts[i];
      
      try {
        // Parse name from company name
        const nameParts = contact.company?.split(' ') || ['Lead', 'Contact'];
        const firstName = nameParts[0] || 'Lead';
        const lastName = nameParts.slice(1).join(' ') || `Contact ${i + 1}`;

        const contactData = {
          firstName: firstName,
          lastName: lastName,
          email: contact.email,
          phone: contact.phone,
          companyName: contact.company,
          website: contact.website,
          address1: contact.location || '',
          source: 'Lead Finder App',
          tags: [smartListName, 'AI Generated', contact.industry || 'Professional Services'],
          customFields: [
            {
              key: 'confidence_score',
              field_value: contact.confidence?.toString() || '0'
            },
            {
              key: 'lead_source',
              field_value: 'AI Search Engine'
            },
            {
              key: 'import_date',
              field_value: new Date().toISOString().split('T')[0]
            }
          ]
        };

        const ghlResponse = await fetch('https://services.leadconnectorhq.com/contacts/', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
            'Version': '2021-07-28'
          },
          body: JSON.stringify(contactData)
        });

        if (ghlResponse.ok) {
          const result = await ghlResponse.json();
          results.push({ 
            success: true, 
            contact: result,
            originalData: contact 
          });
        } else {
          const error = await ghlResponse.text();
          results.push({ 
            success: false, 
            error: `GHL API Error: ${error}`,
            originalData: contact 
          });
        }

        // Rate limiting delay
        await new Promise(resolve => setTimeout(resolve, 250));

      } catch (error) {
        results.push({ 
          success: false, 
          error: error.message,
          originalData: contact 
        });
      }
    }

    const successCount = results.filter(r => r.success).length;
    const failCount = results.length - successCount;

    res.json({
      success: true,
      totalProcessed: contacts.length,
      successCount,
      failCount,
      smartListName,
      results: process.env.NODE_ENV === 'development' ? results : undefined
    });

  } catch (error) {
    console.error('Import error:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message || 'Import failed'
    });
  }
}