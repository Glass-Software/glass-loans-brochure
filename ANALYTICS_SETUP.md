# Analytics & Tracking Setup Guide

This document explains how to set up and manage all tracking pixels for Glass Loans using Google Tag Manager (GTM).

## Overview

Google Tag Manager (GTM) is already installed on the site with ID: **GTM-TBTJ7F7L**

All tracking pixels (Meta/Facebook, ActiveCampaign, Google Analytics, etc.) should be added through the GTM interface, NOT by modifying code.

## Benefits of Using GTM

- Manage all tracking tags in one centralized interface
- Add/remove/modify tags without deploying code
- Built-in tag templates for popular services
- Easy debugging and testing
- Version control and rollback capability

---

## Current Setup

### Google Tag Manager (GTM)
- **Status:** ✅ Installed
- **Container ID:** GTM-TBTJ7F7L
- **Location:** Added in [src/app/layout.tsx](src/app/layout.tsx)
- **Access:** https://tagmanager.google.com/

---

## Adding Tracking Pixels Through GTM

### 1. Meta (Facebook) Pixel

**Step-by-step:**

1. Log in to GTM: https://tagmanager.google.com/
2. Select container: GTM-TBTJ7F7L
3. Click **"Tags"** → **"New"**
4. Name: "Meta Pixel - All Pages"
5. Click **Tag Configuration**:
   - Choose: **Facebook Pixel** (built-in template)
   - Pixel ID: [Get from https://business.facebook.com/events_manager]
   - Track type: **Page View**
6. Click **Triggering**:
   - Choose: **All Pages**
7. Click **Save**
8. Click **Submit** → **Publish**

**Key Events to Track:**
- PageView (automatic on all pages)
- Lead (when user starts underwriting)
- CompleteRegistration (when user verifies email)
- Subscribe (when user upgrades to Pro)
- Purchase (when user completes payment)

**Custom Event Example:**
```javascript
// In your code, trigger GTM events like this:
import { pushGTMEvent } from '@/components/Analytics/GoogleTagManager';

pushGTMEvent('lead', {
  lead_type: 'underwriting_start',
  property_address: address
});
```

Then in GTM:
1. Create a trigger for event name "lead"
2. Create a Meta Pixel tag that fires on that trigger
3. Map the event to Meta's "Lead" event

---

### 2. ActiveCampaign Site Tracking

ActiveCampaign automatically tracks visitors who are already in your database (via email). For event tracking:

**Step-by-step:**

1. Log in to ActiveCampaign: https://yourname.activehosted.com
2. Go to **Settings** → **Tracking** → **Site Tracking**
3. Copy your tracking code
4. In GTM:
   - Tags → New
   - Name: "ActiveCampaign Site Tracking"
   - Tag Configuration → Custom HTML
   - Paste the ActiveCampaign tracking code
   - Triggering → All Pages
   - Save → Publish

**Event Tracking:**

ActiveCampaign uses event tracking URLs. To track custom events in GTM:

1. In GTM, create a new tag:
   - Tag Type: Custom HTML
   - HTML:
     ```html
     <script>
       vgo('setAccount', 'YOUR_ACCOUNT_ID');
       vgo('setTrackByDefault', false);
       vgo('process', 'event', 'EVENT_NAME', {
         attribute1: 'value1',
         attribute2: 'value2'
       });
     </script>
     ```
   - Triggering: Choose your custom trigger (e.g., form submission, button click)

2. Set up triggers for key actions:
   - User starts underwriting
   - User completes report
   - User upgrades to Pro

**Note:** Users are already being added to ActiveCampaign list 11 automatically when they verify their email (see `src/lib/activecampaign/client.ts`).

---

### 3. Google Analytics 4 (Optional)

If you want to track detailed analytics:

**Step-by-step:**

1. Create GA4 property: https://analytics.google.com/
2. Get your Measurement ID (G-XXXXXXXXXX)
3. In GTM:
   - Tags → New
   - Name: "GA4 Configuration"
   - Tag Configuration → Google Analytics: GA4 Configuration
   - Measurement ID: [Your G-XXXXXXXXXX]
   - Triggering → All Pages
   - Save → Publish

4. Add event tags for key actions (optional):
   - Lead generation (underwriting start)
   - Purchases (Pro upgrade)
   - Form submissions

---

## Testing Your Tags

### Preview Mode

1. In GTM, click **Preview** button
2. Enter your website URL: https://glassloans.io
3. Browse your site in the opened tab
4. Check the GTM preview panel to see which tags fire

### Tag Assistant (Chrome Extension)

1. Install: [Tag Assistant Legacy by Google](https://chrome.google.com/webstore)
2. Visit your website
3. Click the extension icon
4. See all active tags and any errors

### Meta Pixel Helper (Chrome Extension)

1. Install: [Meta Pixel Helper](https://chrome.google.com/webstore)
2. Visit your website
3. Click the extension icon
4. Verify pixel is firing correctly

---

## Key Events to Track

Here are the most important events you should track:

| Event | Description | When to Fire | Meta Event | GA4 Event |
|-------|-------------|--------------|------------|-----------|
| **PageView** | User views any page | All pages (automatic) | PageView | page_view |
| **Lead** | User starts underwriting | Step 1 submission | Lead | generate_lead |
| **CompleteRegistration** | User verifies email | Email verification | CompleteRegistration | sign_up |
| **ViewContent** | User views report | Results page load | ViewContent | view_item |
| **InitiateCheckout** | User clicks upgrade | Upgrade button click | InitiateCheckout | begin_checkout |
| **Subscribe** | User upgrades to Pro | Stripe success | Subscribe | subscribe |
| **Purchase** | User completes payment | Stripe webhook | Purchase | purchase |

---

## Adding Events to Your Code

The GTM helper function is already available in your code:

```typescript
import { pushGTMEvent } from '@/components/Analytics/GoogleTagManager';

// Example: Track when user starts underwriting
pushGTMEvent('lead', {
  lead_type: 'underwriting_start',
  property_address: formData.address,
  property_type: formData.propertyType
});

// Example: Track Pro upgrade
pushGTMEvent('subscribe', {
  plan: 'Pro',
  billing: 'monthly',
  value: 29.99,
  currency: 'USD'
});
```

Then in GTM, create triggers and tags that listen for these custom events.

---

## Deployment Notes

### Environment Variables

The GTM ID is set in `.env.example`:
```bash
NEXT_PUBLIC_GTM_ID=GTM-TBTJ7F7L
```

This is a **public** variable (safe to expose in client code) and is embedded at build time.

### Production Deployment

Since `NEXT_PUBLIC_GTM_ID` is a build-time variable, it's passed as a build argument:

```bash
# Already configured in scripts/deploy.sh
./scripts/deploy.sh
```

The deployment script includes the GTM ID as a build arg (see `CLAUDE.md` for details).

### Testing Locally

GTM will work in development mode:
```bash
npm run dev
```

Visit http://localhost:3000 and open GTM Preview mode to test tags locally.

---

## Troubleshooting

### GTM not loading
- Check browser console for errors
- Verify NEXT_PUBLIC_GTM_ID is set correctly
- Check that no ad blockers are interfering

### Tags not firing
- Use GTM Preview mode to debug
- Check trigger conditions
- Verify tag configuration

### Data not appearing in Meta/ActiveCampaign
- Check that Pixel ID is correct
- Verify domain is authorized in platform settings
- Allow 24-48 hours for data to appear in some reports

---

## Resources

- **Google Tag Manager:** https://tagmanager.google.com/
- **GTM Documentation:** https://support.google.com/tagmanager
- **Meta Events Manager:** https://business.facebook.com/events_manager
- **ActiveCampaign Site Tracking:** https://help.activecampaign.com/hc/en-us/articles/221542267
- **GA4 Setup Guide:** https://support.google.com/analytics/answer/9304153

---

## Need Help?

If you need to modify tracking or add new events, refer to this guide or consult the platform-specific documentation linked above.
