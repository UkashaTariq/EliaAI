// api/exa-search.js - Exa.ai Search and Contact Enhancement Handler

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
    const { 
      query, 
      numResults = 20, 
      type = 'neural',
      useAutoprompt = true,
      includeDomains = [],
      excludeDomains = [],
      startCrawlDate = '2023-01-01',
      endCrawlDate = new Date().toISOString().split('T')[0],
      contents = { text: true, highlights: true, summary: true }
    } = req.body;

    if (!query || query.trim().length === 0) {
      return res.status(400).json({ error: 'Search query is required' });
    }

    if (!process.env.NEXT_PUBLIC_EXA_API_KEY) {
      return res.status(500).json({ error: 'Exa API key not configured' });
    }

    // Step 1: Search with Exa.ai
    const exaResponse = await fetch('https://api.exa.ai/search', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.NEXT_PUBLIC_EXA_API_KEY}`,
      },
      body: JSON.stringify({
        query: query,
        type: type,
        useAutoprompt: useAutoprompt,
        numResults: Math.min(numResults, 50), // Limit to 50 results max
        contents: contents,
        includeDomains: includeDomains,
        excludeDomains: [
          ...excludeDomains,
          'facebook.com',
          'twitter.com',
          'instagram.com',
          'tiktok.com', 
          'youtube.com',
          'linkedin.com/in/', // Exclude personal LinkedIn profiles
          'reddit.com'
        ],
        startCrawlDate: startCrawlDate,
        endCrawlDate: endCrawlDate
      })
    });

    if (!exaResponse.ok) {
      const errorData = await exaResponse.json();
      console.error('Exa API Error:', errorData);
      return res.status(500).json({ 
        error: 'Search failed', 
        message: errorData.message || 'Exa API request failed'
      });
    }

    const exaData = await exaResponse.json();

    // Step 2: Process and enhance results
    const enhancedContacts = await enhanceSearchResults(exaData.results || [], query);

    // Step 3: Filter and validate contacts
    const validContacts = enhancedContacts
      .filter(contact => contact.name && contact.name.trim().length > 0)
      .filter(contact => contact.email || contact.phone) // Must have at least one contact method
      .slice(0, numResults); // Limit final results

    return res.status(200).json({
      success: true,
      query: query,
      totalFound: exaData.results?.length || 0,
      totalReturned: validContacts.length,
      contacts: validContacts,
      searchMetadata: {
        searchTime: new Date().toISOString(),
        exaRequestId: exaData.requestId,
        autopromptString: exaData.autopromptString
      }
    });

  } catch (error) {
    console.error('Search handler error:', error);
    return res.status(500).json({ 
      error: 'Search failed', 
      message: error.message 
    });
  }
}

// Enhanced result processing
async function enhanceSearchResults(results, originalQuery) {
  const enhancedContacts = [];

  for (let i = 0; i < results.length; i++) {
    const result = results[i];
    
    try {
      const contact = {
        id: i + 1,
        name: extractBusinessName(result.title, result.text),
        email: extractEmail(result.text) || generateEmail(result.url),
        phone: extractPhone(result.text) || null,
        address: extractAddress(result.text),
        website: cleanUrl(result.url),
        description: generateDescription(result.summary, result.text, result.highlights),
        category: extractCategory(result.text, result.title, originalQuery),
        rating: generateRating(result.text),
        source: 'exa',
        originalTitle: result.title,
        searchQuery: originalQuery,
        createdAt: new Date().toISOString()
      };

      // Validate and clean contact
      if (isValidContact(contact)) {
        enhancedContacts.push(contact);
      }

    } catch (error) {
      console.error(`Error processing result ${i}:`, error);
      // Continue with next result
    }
  }

  return enhancedContacts;
}

// Business name extraction
function extractBusinessName(title, text) {
  if (!title && !text) return 'Unknown Business';
  
  let name = title || '';
  
  // Clean up common patterns
  name = name
    .replace(/\s*-\s*.*$/, '') // Remove everything after dash
    .replace(/\|.*$/, '') // Remove everything after pipe
    .replace(/\s*:\s*.*$/, '') // Remove everything after colon
    .replace(/\([^)]*\)/g, '') // Remove content in parentheses
    .replace(/\s+/g, ' ') // Normalize whitespace
    .trim();

  // If title is too generic, try to extract from text
  if (!name || name.length < 3 || isGenericTitle(name)) {
    const textBasedName = extractNameFromText(text);
    if (textBasedName) {
      name = textBasedName;
    }
  }

  return name.length > 0 ? name : 'Unknown Business';
}

function isGenericTitle(title) {
  const genericTerms = ['home', 'about', 'contact', 'services', 'welcome', 'index'];
  return genericTerms.some(term => title.toLowerCase().includes(term));
}

function extractNameFromText(text) {
  if (!text) return null;
  
  // Look for company name patterns
  const patterns = [
    /(?:Welcome to|About)\s+([A-Z][A-Za-z\s&]{2,30})/i,
    /([A-Z][A-Za-z\s&]{2,30})(?:\s+is\s+a|,\s+a|,\s+an|\s+provides|\s+offers)/i,
    /([A-Z][A-Za-z\s&]{2,30})\s+(?:LLC|Inc|Corporation|Corp|Company|Co)/i
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match && match[1]) {
      return match[1].trim();
    }
  }

  return null;
}

// Email extraction and generation
function extractEmail(text) {
  if (!text) return null;
  
  const emailRegex = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g;
  const matches = text.match(emailRegex);
  
  if (matches) {
    // Filter out common non-business emails
    const validEmails = matches.filter(email => {
      const domain = email.toLowerCase();
      return !domain.includes('gmail.com') && 
             !domain.includes('yahoo.com') && 
             !domain.includes('hotmail.com') &&
             !domain.includes('outlook.com');
    });
    
    return validEmails[0] || matches[0];
  }
  
  return null;
}

function generateEmail(url) {
  try {
    const domain = new URL(url).hostname.replace('www.', '');
    const commonPrefixes = ['info', 'contact', 'hello', 'sales'];
    const prefix = commonPrefixes[Math.floor(Math.random() * commonPrefixes.length)];
    return `${prefix}@${domain}`;
  } catch {
    return null;
  }
}

// Phone extraction
function extractPhone(text) {
  if (!text) return null;
  
  const phonePatterns = [
    /(\+1[-.\s]?)?\(?([0-9]{3})\)?[-.\s]?([0-9]{3})[-.\s]?([0-9]{4})/g,
    /(\+1[-.\s]?)?([0-9]{3})[-.\s]?([0-9]{3})[-.\s]?([0-9]{4})/g,
    /\b\d{3}[-.\s]?\d{3}[-.\s]?\d{4}\b/g
  ];

  for (const pattern of phonePatterns) {
    const matches = text.match(pattern);
    if (matches) {
      // Format the first valid phone number
      return formatPhoneNumber(matches[0]);
    }
  }
  
  return null;
}

function formatPhoneNumber(phone) {
  const digits = phone.replace(/\D/g, '');
  
  if (digits.length === 10) {
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  } else if (digits.length === 11 && digits[0] === '1') {
    return `+1 (${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`;
  }
  
  return phone;
}

// Address extraction
function extractAddress(text) {
  if (!text) return null;
  
  const addressPatterns = [
    /\d+\s+[A-Za-z\s]+(?:Street|St|Avenue|Ave|Road|Rd|Boulevard|Blvd|Drive|Dr|Lane|Ln|Way|Court|Ct)[,\s]+[A-Za-z\s]+[,\s]+[A-Z]{2}\s+\d{5}/gi,
    /\d+\s+[A-Za-z\s]+[,\s]+[A-Za-z\s]+[,\s]+[A-Z]{2}\s+\d{5}/gi
  ];

  for (const pattern of addressPatterns) {
    const match = text.match(pattern);
    if (match) {
      return match[0].trim();
    }
  }
  
  return null;
}

// Description generation
function generateDescription(summary, text, highlights) {
  let description = summary || '';
  
  if (!description && highlights && highlights.length > 0) {
    description = highlights.join(' ');
  }
  
  if (!description && text) {
    description = text.substring(0, 200);
  }
  
  if (description) {
    description = description.replace(/\s+/g, ' ').trim();
    if (description.length > 200) {
      description = description.substring(0, 200) + '...';
    }
  }
  
  return description || 'Business information not available';
}

// Category extraction
function extractCategory(text, title, query) {
  const content = `${title} ${text}`.toLowerCase();
  const queryLower = query.toLowerCase();
  
  const categories = {
    'automotive': ['car', 'auto', 'dealer', 'vehicle', 'automotive'],
    'real estate': ['real estate', 'realtor', 'property', 'homes', 'broker'],
    'healthcare': ['doctor', 'medical', 'healthcare', 'clinic', 'physician', 'dentist'],
    'restaurant': ['restaurant', 'dining', 'food', 'cuisine', 'eatery', 'cafe'],
    'technology': ['technology', 'software', 'tech', 'IT', 'startup', 'digital'],
    'legal': ['law', 'attorney', 'lawyer', 'legal', 'firm'],
    'retail': ['store', 'shop', 'retail', 'boutique', 'marketplace'],
    'construction': ['construction', 'contractor', 'builder', 'renovation'],
    'beauty': ['salon', 'beauty', 'spa', 'cosmetic', 'hair'],
    'finance': ['bank', 'financial', 'accounting', 'investment', 'insurance']
  };

  // First check if query contains category hints
  for (const [category, keywords] of Object.entries(categories)) {
    if (keywords.some(keyword => queryLower.includes(keyword))) {
      return category.charAt(0).toUpperCase() + category.slice(1);
    }
  }

  // Then check content
  for (const [category, keywords] of Object.entries(categories)) {
    if (keywords.some(keyword => content.includes(keyword))) {
      return category.charAt(0).toUpperCase() + category.slice(1);
    }
  }

  return 'Business';
}

// Rating generation (mock rating based on content quality)
function generateRating(text) {
  let score = 3.0; // Base rating
  
  if (text) {
    // Longer, more detailed content gets higher rating
    if (text.length > 500) score += 0.5;
    if (text.length > 1000) score += 0.3;
    
    // Professional keywords boost rating
    const positiveKeywords = ['professional', 'certified', 'licensed', 'experienced', 'quality', 'service'];
    const keywordCount = positiveKeywords.filter(keyword => 
      text.toLowerCase().includes(keyword)
    ).length;
    
    score += keywordCount * 0.2;
  }
  
  // Add some randomness and cap at 5.0
  score += (Math.random() - 0.5) * 0.4;
  return Math.min(5.0, Math.max(1.0, Math.round(score * 10) / 10));
}

// URL cleaning
function cleanUrl(url) {
  try {
    const urlObj = new URL(url);
    return urlObj.hostname.replace('www.', '') + (urlObj.pathname !== '/' ? urlObj.pathname : '');
  } catch {
    return url;
  }
}

// Contact validation
function isValidContact(contact) {
  // Must have a name
  if (!contact.name || contact.name.trim().length < 2) {
    return false;
  }

  // Must have at least email or phone
  if (!contact.email && !contact.phone) {
    return false;
  }

  // Validate email format if present
  if (contact.email && !isValidEmail(contact.email)) {
    return false;
  }

  // Filter out obviously invalid business names
  const invalidNames = ['error', 'not found', '404', 'page not found', 'home', 'index'];
  if (invalidNames.some(invalid => contact.name.toLowerCase().includes(invalid))) {
    return false;
  }

  return true;
}

function isValidEmail(email) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

// Clean URL helper
function cleanUrl(url) {
  try {
    const urlObj = new URL(url);
    let cleanedUrl = urlObj.hostname.replace('www.', '');
    
    // Add path if it's not just root
    if (urlObj.pathname && urlObj.pathname !== '/') {
      cleanedUrl += urlObj.pathname;
    }
    
    return cleanedUrl;
  } catch {
    return url;
  }
}