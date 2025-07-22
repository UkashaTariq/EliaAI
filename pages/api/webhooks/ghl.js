import crypto from 'crypto';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Verify webhook signature if shared secret is configured
    if (process.env.GHL_SHARED_SECRET) {
      const signature = req.headers['x-ghl-signature'];
      const body = JSON.stringify(req.body);
      const hash = crypto
        .createHmac('sha256', process.env.GHL_SHARED_SECRET)
        .update(body)
        .digest('hex');

      if (signature !== hash) {
        return res.status(401).json({ error: 'Invalid signature' });
      }
    }

    const { type, locationId, eventData } = req.body;

    console.log(`📨 Webhook received: ${type} for location ${locationId}`);

    // Handle different webhook events
    switch (type) {
      case 'ContactCreate':
        if (eventData?.source === 'Lead Finder App') {
          console.log('✅ Our contact was created successfully:', eventData.id);
        }
        break;

      case 'AppInstalled':
        console.log('🎉 App installed for location:', locationId);
        // You could initialize user data or send welcome message
        break;

      case 'AppUninstalled':
        console.log('👋 App uninstalled for location:', locationId);
        // Cleanup any cached data if needed
        break;

      case 'SubscriptionCreated':
        console.log('💰 Subscription created:', eventData);
        break;

      case 'SubscriptionUpdated':
        console.log('📝 Subscription updated:', eventData);
        break;

      case 'SubscriptionCancelled':
        console.log('❌ Subscription cancelled:', eventData);
        break;

      default:
        console.log(`🤷 Unhandled webhook type: ${type}`);
    }

    res.json({ 
      success: true,
      message: `Processed ${type} webhook`
    });

  } catch (error) {
    console.error('Webhook error:', error);
    res.status(500).json({ 
      success: false,
      error: 'Webhook processing failed'
    });
  }
}

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '1mb',
    },
  },
}