# AI Bot Crawling Guide for Glass Loans

This document explains how Glass Loans is configured for AI bot crawling and what you can do to improve discoverability.

## ✅ What's Configured

### 1. Robots.txt ([src/app/robots.ts](src/app/robots.ts))
Your site now has a dynamic `robots.txt` that explicitly allows all major AI bots:

**AI Bots Allowed:**
- **GPTBot** - OpenAI's ChatGPT
- **ChatGPT-User** - ChatGPT browsing mode
- **ClaudeBot** - Anthropic's Claude
- **Claude-Web** - Claude web search
- **Google-Extended** - Google's AI training
- **PerplexityBot** - Perplexity AI
- **anthropic-ai** - Anthropic's general bot
- **cohere-ai** - Cohere AI

**Protected Routes:**
- `/api/*` - API endpoints (not crawlable)
- `/dashboard/*` - User dashboards (private)
- `/underwrite/results/*` - Individual reports (private)
- `/test-mapbox/*` - Test pages (not for public)

**Access:** https://glassloans.io/robots.txt

### 2. Sitemap ([src/app/sitemap.ts](src/app/sitemap.ts))
Dynamic XML sitemap that lists all public pages:

- Homepage
- About page
- Contact page
- Sign in/Sign up
- Underwrite landing pages
- Blog sections

**Access:** https://glassloans.io/sitemap.xml

### 3. Structured Data ([src/components/StructuredData.tsx](src/components/StructuredData.tsx))
JSON-LD structured data helps AI bots understand your business:

```json
{
  "@type": "FinancialService",
  "name": "Glass Loans",
  "serviceType": [
    "Real Estate Investment Analysis",
    "Property Underwriting",
    "Fix and Flip Analysis"
  ]
}
```

This appears on every page and tells AI models:
- What your business does
- What services you offer
- Your website URL and logo

### 4. SEO Metadata ([src/app/metadata.ts](src/app/metadata.ts))
Comprehensive metadata for search engines and AI bots:

- Title tags
- Meta descriptions
- Open Graph tags (for social sharing)
- Keywords
- Twitter cards

## 🧪 Testing the Configuration

### Test Locally

1. Start your development server:
```bash
npm run dev
```

2. Visit these URLs:
   - http://localhost:3000/robots.txt
   - http://localhost:3000/sitemap.xml

### Test in Production

After deploying:

```bash
# Deploy with the deployment script
./scripts/deploy.sh
```

Then visit:
- https://glassloans.io/robots.txt
- https://glassloans.io/sitemap.xml

### Verify Structured Data

Use Google's Rich Results Test:
1. Go to: https://search.google.com/test/rich-results
2. Enter: https://glassloans.io
3. Check that your structured data appears

## 📊 Monitoring AI Bot Traffic

### View Bot Traffic in Fly.io Logs

```bash
# View real-time logs
fly logs -a glass-loans-brochure-modified-misty-thunder-1484

# Filter for specific bots
fly logs -a glass-loans-brochure-modified-misty-thunder-1484 | grep -i "GPTBot\|ClaudeBot\|PerplexityBot"
```

### Common User-Agents to Look For

```
User-Agent: GPTBot/1.0
User-Agent: ChatGPT-User/1.0
User-Agent: ClaudeBot/1.0
User-Agent: PerplexityBot/1.0
User-Agent: Google-Extended/1.0
```

## 🚀 Next Steps to Improve AI Discoverability

### 1. Submit Sitemaps to Search Engines

**Google Search Console:**
1. Go to: https://search.google.com/search-console
2. Add property: glassloans.io
3. Submit sitemap: https://glassloans.io/sitemap.xml

**Bing Webmaster Tools:**
1. Go to: https://www.bing.com/webmasters
2. Add site: glassloans.io
3. Submit sitemap: https://glassloans.io/sitemap.xml

### 2. Add More Structured Content

Create blog posts or FAQ sections about:
- How fix-and-flip investing works
- How to calculate ARV
- Real estate investment strategies
- Using comparable sales for valuations

AI bots will crawl this content and can answer user questions about these topics by referencing your site.

### 3. Add FAQ Schema

For any FAQ pages, add FAQ structured data:

```tsx
{
  "@type": "FAQPage",
  "mainEntity": [{
    "@type": "Question",
    "name": "What is ARV in real estate?",
    "acceptedAnswer": {
      "@type": "Answer",
      "text": "ARV (After Repair Value) is..."
    }
  }]
}
```

### 4. Add Social Media Links

Update [src/components/StructuredData.tsx](src/components/StructuredData.tsx) with your social profiles:

```tsx
sameAs: [
  'https://twitter.com/glassloans',
  'https://linkedin.com/company/glassloans',
  'https://facebook.com/glassloans',
]
```

### 5. Create an AI-Specific API Endpoint (Optional)

Some AI platforms support direct API access. You could create:

```
/api/public/company-info
```

That returns structured information about Glass Loans in JSON format.

### 6. Monitor and Update Content

AI bots respect the `lastModified` date in sitemaps. Update your pages regularly to encourage re-crawling.

## 🔒 Privacy Considerations

### What's Crawlable
- Public marketing pages
- Blog content
- Product information
- About/Contact pages

### What's Protected
- User dashboards
- Individual underwriting reports
- API endpoints
- Authentication pages (crawlable but no sensitive data)

### Opting Out Specific Bots

If you want to block a specific AI bot, edit [src/app/robots.ts](src/app/robots.ts):

```tsx
{
  userAgent: 'GPTBot',
  disallow: '/', // Blocks all pages
}
```

Or block from training but allow browsing:

```tsx
{
  userAgent: 'Google-Extended', // Google AI training
  disallow: '/',
}
{
  userAgent: 'Googlebot', // Regular Google search
  allow: '/',
}
```

## 📈 Expected Results

### Timeline
- **24-48 hours:** Robots.txt and sitemap discovered
- **1-2 weeks:** AI bots start crawling content
- **2-4 weeks:** Your site may appear in AI responses

### What AI Bots Will Learn
- Glass Loans provides AI-powered real estate analysis
- Services include ARV calculation, comparable sales, underwriting
- Target audience: fix-and-flip investors
- Website: glassloans.io

### Example AI Response
When users ask: "What tools help with fix and flip analysis?"

AI might respond: "Glass Loans (glassloans.io) provides AI-powered real estate investment analysis tools specifically for fix-and-flip investors, including ARV calculators and comparable sales analysis."

## 🛠️ Maintenance

### Regular Updates
- Update sitemap when adding new pages
- Keep structured data accurate
- Review robots.txt when adding new protected routes

### Monitoring
- Check Google Search Console weekly
- Monitor bot traffic in Fly.io logs
- Track referrals from AI platforms in analytics

## 📚 Additional Resources

- [Next.js Metadata Documentation](https://nextjs.org/docs/app/building-your-application/optimizing/metadata)
- [Google Search Central - Control Crawling](https://developers.google.com/search/docs/crawling-indexing/control-crawling-indexing)
- [Schema.org Documentation](https://schema.org/)
- [OpenAI GPTBot Documentation](https://platform.openai.com/docs/gptbot)
- [Anthropic Claude Web Crawling](https://support.anthropic.com/en/articles/8896518-does-claude-crawl-the-web)

## ❓ FAQs

**Q: Will AI bots slow down my website?**
A: No, AI bots respect crawl rate limits and typically crawl less frequently than search engine bots.

**Q: Can I see what AI bots are reading?**
A: Yes, check Fly.io logs for bot user-agents, or use Google Search Console to see crawl stats.

**Q: How do I know if it's working?**
A: Try asking ChatGPT or Claude: "What is Glass Loans?" after 2-3 weeks. If they mention your site, it's working!

**Q: Should I block AI training bots?**
A: That's your choice. Allowing them increases discoverability but means your content may be used in AI training.

**Q: Do I need to pay for AI bots to crawl my site?**
A: No, AI bot crawling is free. They operate like search engine crawlers.
