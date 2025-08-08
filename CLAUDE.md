# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

EliaAI is a GoHighLevel embedded app that provides AI-powered contact discovery and enrichment. Built with Next.js 15 (Pages Router), it integrates with Exa.ai for business search and GoHighLevel's API for contact import functionality.

**Core Functionality:**
- Users search for businesses using natural language queries
- Exa.ai API provides enriched contact data with email/phone extraction
- Users can select contacts and import them into GoHighLevel Smart Lists
- OAuth integration handles GoHighLevel authentication and permissions

## Development Commands

```bash
# Development server with Turbopack
npm run dev

# Production build
npm run build

# Start production server
npm start

# Linting
npm run lint
```

## Architecture & Key Components

### Enhanced Authentication & Session Management
- **OAuth Integration**: Uses GoHighLevel OAuth2 for app installation with enhanced session tracking
- **Session Management**: Iron Session-based secure session handling with automatic location change detection
- **Multi-method Auth**: Dashboard checks session first, then falls back to URL identifiers and context detection
- **Firebase Admin**: `src/lib/firebaseAdmin.ts` manages user data and subscription persistence
- **Session Utils**: `src/lib/session-utils.ts` provides session creation, validation, and management utilities
- **API Routes**: `/api/auth/*` endpoints handle OAuth flow, session management, and logout
- **Location Change Detection**: Automatically detects when user switches locations and creates new sessions
- **Auto-redirect**: Users with valid sessions are automatically redirected to dashboard

### Contact Search & Import with Usage Tracking
- **Exa.ai Integration**: `src/pages/api/exaSearch.ts` with authentication and usage limit checks
  - Regular search with batching for large result sets
  - Websets approach for enhanced data enrichment
  - Automatic usage tracking and limit enforcement
- **Contact Extraction**: Email/phone extraction from web content with multiple fallback patterns
- **GoHighLevel Import**: `src/pages/api/importContacts.ts` creates contacts in user's GHL account
- **Usage Tracking**: `src/lib/usage-tracking.ts` monitors search limits and records usage statistics
- **GHL Billing Integration**: `src/lib/ghl-billing.ts` handles marketplace subscriptions and plan management

### Frontend Architecture
- **Dashboard Component**: `src/pages/dashboard.tsx` with session-based authentication and subscription management
- **Subscription Components**: 
  - `src/components/SubscriptionBanner.tsx` displays usage limits and plan information
  - `src/components/UpgradeModal.tsx` handles plan upgrades via Stripe Checkout
- **State Management**: Uses React hooks for local state, session-based user management
- **Responsive Design**: Tailwind CSS with custom color scheme and modern gradients
- **Real-time Updates**: Usage limits update in real-time after searches

## Technology Stack

- **Framework**: Next.js 15 with Pages Router (NOT App Router)
- **Styling**: Tailwind CSS 4
- **Database**: Firebase Firestore via firebase-admin
- **Session Management**: Iron Session for secure cookie-based sessions
- **Payments**: GoHighLevel Marketplace billing integration
- **External APIs**: Exa.ai for search, GoHighLevel for contacts and billing
- **Icons**: Lucide React
- **Utilities**: UUID for unique identifiers
- **TypeScript**: Strict mode enabled with comprehensive interfaces

## Environment Variables

Required for development (see `.env.local.example`):
```bash
# Session & App
SESSION_SECRET=        # Long random string for session encryption
NEXT_PUBLIC_APP_URL=   # App URL for redirects

# GoHighLevel OAuth & Marketplace
GOHIGHLEVEL_CLIENT_ID=
GOHIGHLEVEL_CLIENT_SECRET=
GOHIGHLEVEL_REDIRECT_URI=
GOHIGHLEVEL_APP_ID=       # Your app ID in GHL Marketplace

# Firebase
FIREBASE_PROJECT_ID=
FIREBASE_CLIENT_EMAIL=
FIREBASE_PRIVATE_KEY=

# Exa.ai
EXA_API_KEY=
```

## Code Conventions

- **Path Alias**: Use `@/*` for `src/*` imports
- **API Routes**: Located in `src/pages/api/` following Next.js conventions
- **Error Handling**: Comprehensive try-catch blocks with user-friendly error messages
- **Contact Data**: Always validate email/phone presence before processing
- **TypeScript**: Use proper interfaces defined in `src/lib/firestore-schema.ts`
- **Session Management**: Always check authentication before performing operations
- **Usage Tracking**: Record search usage and check limits before allowing operations
- **GHL Integration**: Use marketplace billing system, handle webhooks for subscription events

## Important Implementation Details

### Session & Authentication
- **Session Security**: Iron Session with 30-day expiration and automatic cleanup
- **Location Change Detection**: Automatically invalidates sessions when user switches GHL locations
- **Multi-level Auth**: Session-first approach with URL identifier fallbacks
- **Auto-redirect**: Valid sessions automatically redirect to dashboard

### Subscription & Usage Management
- **Three-tier Plans**: Free (10 searches), Basic ($29, 100 searches), Pro ($99, 500 searches)
- **Real-time Limits**: Search limits enforced before API calls with user-friendly error messages
- **Usage Reset**: Monthly usage resets automatically based on billing periods
- **GHL Marketplace**: Native integration with GoHighLevel's billing system
- **Automatic Sync**: Subscription status synced with GHL marketplace in real-time

### Search & Data Processing
- **Batch Processing**: Large search results processed in configurable batches
- **Contact Validation**: Only contacts with email OR phone included in results
- **Usage Recording**: Every search recorded with metadata for analytics
- **Rate Limiting**: Built-in delays between API calls to prevent rate limit issues

### Database Schema
- **Collections**: `app_installs`, `user_sessions`, `subscriptions`, `search_usage`
- **Automatic Cleanup**: Expired sessions marked inactive, not deleted for audit
- **Subscription Sync**: Firestore and GHL marketplace kept in sync via webhooks

## GoHighLevel Marketplace Setup

1. **App Registration**: Register your app in the GoHighLevel Marketplace
2. **Pricing Plans**: Configure Basic ($29/month) and Pro ($99/month) plans in the marketplace
3. **Webhook Setup**: Configure webhook endpoint pointing to `/api/ghl/webhook`
4. **Webhook Events**: Enable `subscription.created`, `subscription.updated`, `subscription.cancelled`, `subscription.expired`, `app.installed`, `app.uninstalled`
5. **App ID**: Add your marketplace app ID to environment variables

## Firestore Collections Schema

- **app_installs**: User OAuth data with location information and GHL integration
- **user_sessions**: Active session tracking with automatic cleanup
- **subscriptions**: Plan details, usage counters, billing periods, and GHL marketplace sync
- **search_usage**: Individual search records for analytics and billing

## GHL Marketplace Integration Benefits

- **Native Billing**: Users pay through their existing GoHighLevel account
- **Seamless Experience**: No separate payment forms or accounts needed
- **Automatic Provisioning**: Subscriptions activate immediately upon payment
- **Unified Management**: Billing managed alongside other GHL services
- **Better Conversion**: Users trust the familiar GHL payment system