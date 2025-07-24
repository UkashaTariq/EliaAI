// src/api/gohighlevel.js
import { API_CONFIG } from '../utils/config';

class GoHighLevelAPI {
  constructor() {
    this.baseURL = API_CONFIG.GHL_API_URL;
    this.clientId = API_CONFIG.GHL_CLIENT_ID;
    this.redirectUri = API_CONFIG.GHL_REDIRECT_URI;
    this.accessToken = null;
    this.refreshToken = null;
    this.tokenExpiry = null;
  }

  // OAuth Authentication
  getAuthUrl(state = null) {
    const params = new URLSearchParams({
      response_type: 'code',
      client_id: this.clientId,
      redirect_uri: this.redirectUri,
      scope: 'contacts.write contacts.read locations.read',
      state: state || this.generateState()
    });

    return `${this.baseURL}/oauth/chooselocation?${params.toString()}`;
  }

  generateState() {
    return Math.random().toString(36).substring(2, 15) + 
           Math.random().toString(36).substring(2, 15);
  }

  async exchangeCodeForToken(code) {
    try {
      const response = await fetch('/api/ghl-auth', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ code })
      });

      if (!response.ok) {
        throw new Error('Token exchange failed');
      }

      const tokens = await response.json();
      this.setTokens(tokens);
      return tokens;
    } catch (error) {
      console.error('Token exchange error:', error);
      throw new Error('Authentication failed. Please try again.');
    }
  }

  setTokens({ access_token, refresh_token, expires_in }) {
    this.accessToken = access_token;
    this.refreshToken = refresh_token;
    this.tokenExpiry = new Date(Date.now() + (expires_in * 1000));
    
    // Store in localStorage for persistence (in production, use secure storage)
    if (typeof window !== 'undefined') {
      localStorage.setItem('ghl_access_token', access_token);
      localStorage.setItem('ghl_refresh_token', refresh_token);
      localStorage.setItem('ghl_token_expiry', this.tokenExpiry.toISOString());
    }
  }

  loadStoredTokens() {
    if (typeof window !== 'undefined') {
      this.accessToken = localStorage.getItem('ghl_access_token');
      this.refreshToken = localStorage.getItem('ghl_refresh_token');
      const expiry = localStorage.getItem('ghl_token_expiry');
      this.tokenExpiry = expiry ? new Date(expiry) : null;
    }
  }

  async ensureValidToken() {
    this.loadStoredTokens();

    if (!this.accessToken) {
      throw new Error('No access token available. Please authenticate.');
    }

    if (this.tokenExpiry && new Date() >= this.tokenExpiry) {
      await this.refreshAccessToken();
    }
  }

  async refreshAccessToken() {
    if (!this.refreshToken) {
      throw new Error('No refresh token available. Please re-authenticate.');
    }

    try {
      const response = await fetch('/api/ghl-refresh', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ refresh_token: this.refreshToken })
      });

      if (!response.ok) {
        throw new Error('Token refresh failed');
      }

      const tokens = await response.json();
      this.setTokens(tokens);
    } catch (error) {
      console.error('Token refresh error:', error);
      this.clearTokens();
      throw new Error('Session expired. Please re-authenticate.');
    }
  }

  clearTokens() {
    this.accessToken = null;
    this.refreshToken = null;
    this.tokenExpiry = null;
    
    if (typeof window !== 'undefined') {
      localStorage.removeItem('ghl_access_token');
      localStorage.removeItem('ghl_refresh_token');
      localStorage.removeItem('ghl_token_expiry');
    }
  }

  async makeRequest(endpoint, options = {}) {
    await this.ensureValidToken();

    const config = {
      headers: {
        'Authorization': `Bearer ${this.accessToken}`,
        'Content-Type': 'application/json',
        'Version': '2021-07-28',
        ...options.headers
      },
      ...options
    };

    const response = await fetch(`${this.baseURL}${endpoint}`, config);

    if (response.status === 401) {
      await this.refreshAccessToken();
      config.headers['Authorization'] = `Bearer ${this.accessToken}`;
      return fetch(`${this.baseURL}${endpoint}`, config);
    }

    return response;
  }

  // Contact Management
  async createContact(contactData) {
    try {
      const response = await this.makeRequest('/contacts/', {
        method: 'POST',
        body: JSON.stringify({
          firstName: contactData.firstName || '',
          lastName: contactData.lastName || '',
          name: contactData.name,
          email: contactData.email,
          phone: contactData.phone,
          address1: contactData.address,
          city: contactData.city || '',
          state: contactData.state || '',
          postalCode: contactData.postalCode || '',
          website: contactData.website,
          companyName: contactData.companyName || contactData.name,
          tags: contactData.tags || [],
          customFields: contactData.customFields || [],
          source: 'EXA_IMPORT'
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to create contact');
      }

      return await response.json();
    } catch (error) {
      console.error('Create contact error:', error);
      throw error;
    }
  }

  async bulkCreateContacts(contacts) {
    const results = [];
    const errors = [];

    for (const contact of contacts) {
      try {
        const result = await this.createContact(contact);
        results.push(result);
      } catch (error) {
        errors.push({ contact, error: error.message });
      }
    }

    return { results, errors };
  }

  // Smart List Management
  async createSmartList(name, description = '') {
    try {
      const response = await this.makeRequest('/contacts/tags', {
        method: 'POST',
        body: JSON.stringify({
          name: name,
          color: '#3b82f6' // Blue color
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to create smart list');
      }

      return await response.json();
    } catch (error) {
      console.error('Create smart list error:', error);
      throw error;
    }
  }

  async getSmartLists() {
    try {
      const response = await this.makeRequest('/contacts/tags');

      if (!response.ok) {
        throw new Error('Failed to fetch smart lists');
      }

      const data = await response.json();
      return data.tags || [];
    } catch (error) {
      console.error('Get smart lists error:', error);
      throw error;
    }
  }

  // Import Process
  async importContactsToSmartList(contacts, smartListName) {
    try {
      // Step 1: Create or get smart list
      let smartList;
      try {
        smartList = await this.createSmartList(smartListName);
      } catch (error) {
        // If smart list already exists, that's okay
        console.log('Smart list might already exist:', error.message);
      }

      // Step 2: Process contacts for import
      const processedContacts = contacts.map(contact => ({
        firstName: this.extractFirstName(contact.name),
        lastName: this.extractLastName(contact.name),
        name: contact.name,
        email: contact.email,
        phone: contact.phone,
        address: contact.address,
        website: contact.website,
        companyName: contact.name,
        tags: [smartListName, 'EXA_IMPORT'],
        customFields: [
          {
            key: 'business_category',
            field_value: contact.category
          },
          {
            key: 'rating',
            field_value: contact.rating?.toString() || '0'
          },
          {
            key: 'description',
            field_value: contact.description
          },
          {
            key: 'import_source',
            field_value: 'EXA_AI'
          },
          {
            key: 'import_date',
            field_value: new Date().toISOString().split('T')[0]
          }
        ]
      }));

      // Step 3: Bulk create contacts
      const importResult = await this.bulkCreateContacts(processedContacts);

      return {
        success: true,
        smartListName,
        totalContacts: contacts.length,
        successfulImports: importResult.results.length,
        errors: importResult.errors,
        results: importResult.results
      };
    } catch (error) {
      console.error('Import error:', error);
      throw new Error(`Import failed: ${error.message}`);
    }
  }

  extractFirstName(fullName) {
    if (!fullName) return '';
    const parts = fullName.trim().split(' ');
    return parts[0] || '';
  }

  extractLastName(fullName) {
    if (!fullName) return '';
    const parts = fullName.trim().split(' ');
    return parts.length > 1 ? parts.slice(1).join(' ') : '';
  }

  // User Info
  async getCurrentUser() {
    try {
      const response = await this.makeRequest('/users/search');

      if (!response.ok) {
        throw new Error('Failed to get user info');
      }

      return await response.json();
    } catch (error) {
      console.error('Get user error:', error);
      throw error;
    }
  }

  // Location Info
  async getLocations() {
    try {
      const response = await this.makeRequest('/locations/search');

      if (!response.ok) {
        throw new Error('Failed to get locations');
      }

      return await response.json();
    } catch (error) {
      console.error('Get locations error:', error);
      throw error;
    }
  }

  // Utility Methods
  isAuthenticated() {
    this.loadStoredTokens();
    return !!this.accessToken && (!this.tokenExpiry || new Date() < this.tokenExpiry);
  }

  logout() {
    this.clearTokens();
  }
}

export default new GoHighLevelAPI();