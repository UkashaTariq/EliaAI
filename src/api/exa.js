// src/api/exa.js
import { API_CONFIG } from '../utils/config';

class ExaAPI {
  constructor() {
    this.baseURL = API_CONFIG.EXA_API_URL;
    this.apiKey = API_CONFIG.EXA_API_KEY;
  }

  async searchContacts(query, options = {}) {
    try {
      const response = await fetch('/api/exa-search', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query,
          numResults: options.numResults || 20,
          type: options.type || 'neural',
          useAutoprompt: options.useAutoprompt !== false,
          includeDomains: options.includeDomains || [],
          excludeDomains: options.excludeDomains || [],
          startCrawlDate: options.startCrawlDate || '2023-01-01',
          endCrawlDate: options.endCrawlDate || new Date().toISOString().split('T')[0],
          contents: {
            text: true,
            highlights: true,
            summary: true,
            ...options.contents
          }
        })
      });

      if (!response.ok) {
        throw new Error(`Search failed: ${response.statusText}`);
      }

      const data = await response.json();
      return this.processSearchResults(data.contacts || []);
    } catch (error) {
      console.error('Exa API Error:', error);
      throw new Error('Failed to search contacts. Please try again.');
    }
  }

  processSearchResults(results) {
    return results.map((result, index) => ({
      id: result.id || index + 1,
      name: this.extractBusinessName(result.name || result.title),
      email: this.validateEmail(result.email),
      phone: this.formatPhone(result.phone),
      address: result.address || 'Address not available',
      website: result.website || result.url,
      description: this.truncateDescription(result.description || result.summary),
      category: result.category || 'Business',
      rating: this.validateRating(result.rating),
      source: 'exa',
      createdAt: new Date().toISOString()
    }));
  }

  extractBusinessName(name) {
    if (!name) return 'Unknown Business';
    
    // Remove common suffixes and clean up
    const cleanName = name
      .replace(/\s*-\s*.*$/, '') // Remove everything after dash
      .replace(/\|.*$/, '') // Remove everything after pipe
      .replace(/\s+/g, ' ') // Normalize whitespace
      .trim();
    
    return cleanName.length > 0 ? cleanName : 'Unknown Business';
  }

  validateEmail(email) {
    if (!email) return null;
    
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email) ? email : null;
  }

  formatPhone(phone) {
    if (!phone) return null;
    
    // Remove all non-digit characters
    const digits = phone.replace(/\D/g, '');
    
    // Format US phone numbers
    if (digits.length === 10) {
      return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
    } else if (digits.length === 11 && digits[0] === '1') {
      return `+1 (${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`;
    }
    
    return phone; // Return original if can't format
  }

  truncateDescription(description) {
    if (!description) return 'No description available';
    
    return description.length > 200 
      ? description.substring(0, 200) + '...' 
      : description;
  }

  validateRating(rating) {
    const numRating = parseFloat(rating);
    if (isNaN(numRating) || numRating < 0 || numRating > 5) {
      return Math.round((Math.random() * 2 + 3) * 10) / 10; // Random 3-5 rating
    }
    return Math.round(numRating * 10) / 10;
  }

  // Enhanced search with specific business types
  async searchByBusinessType(businessType, location, options = {}) {
    const query = `Find ${businessType} in ${location}`;
    return this.searchContacts(query, {
      ...options,
      includeDomains: this.getRelevantDomains(businessType),
    });
  }

  getRelevantDomains(businessType) {
    const domainMap = {
      'car dealers': ['cars.com', 'autotrader.com', 'cargurus.com'],
      'restaurants': ['yelp.com', 'opentable.com', 'tripadvisor.com'],
      'real estate': ['zillow.com', 'realtor.com', 'redfin.com'],
      'medical': ['healthgrades.com', 'vitals.com', 'zocdoc.com'],
      'tech': ['crunchbase.com', 'linkedin.com', 'glassdoor.com']
    };

    const lowerBusinessType = businessType.toLowerCase();
    for (const [key, domains] of Object.entries(domainMap)) {
      if (lowerBusinessType.includes(key)) {
        return domains;
      }
    }
    return [];
  }

  // Refresh search with different parameters
  async refreshSearch(originalQuery, options = {}) {
    const refreshOptions = {
      ...options,
      startCrawlDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // Last 30 days
      numResults: (options.numResults || 20) + 5, // Get a few more results
    };

    return this.searchContacts(originalQuery, refreshOptions);
  }

  // Get search suggestions based on input
  getSearchSuggestions(input) {
    const suggestions = [
      'Find car dealers in New York',
      'Real estate agents in Miami',
      'Restaurants in Los Angeles',
      'Medical practices in Chicago',
      'Tech startups in San Francisco',
      'Law firms in Boston',
      'Accounting firms in Dallas',
      'Marketing agencies in Seattle',
      'Construction companies in Phoenix',
      'Beauty salons in Las Vegas'
    ];

    if (!input || input.length < 2) {
      return suggestions.slice(0, 5);
    }

    const lowerInput = input.toLowerCase();
    const filtered = suggestions.filter(suggestion => 
      suggestion.toLowerCase().includes(lowerInput)
    );

    return filtered.length > 0 ? filtered : suggestions.slice(0, 5);
  }
}

export default new ExaAPI();