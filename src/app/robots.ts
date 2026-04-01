import { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  const baseUrl = 'https://glassloans.io';

  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: [
          '/api/',
          '/dashboard/',
          '/underwrite/results/',
          '/test-mapbox/',
        ],
      },
      // Specific AI bot configurations
      {
        userAgent: 'GPTBot', // OpenAI's ChatGPT
        allow: '/',
        disallow: [
          '/api/',
          '/dashboard/',
          '/underwrite/results/',
          '/test-mapbox/',
        ],
      },
      {
        userAgent: 'ChatGPT-User', // ChatGPT browsing
        allow: '/',
        disallow: [
          '/api/',
          '/dashboard/',
          '/underwrite/results/',
          '/test-mapbox/',
        ],
      },
      {
        userAgent: 'ClaudeBot', // Anthropic's Claude
        allow: '/',
        disallow: [
          '/api/',
          '/dashboard/',
          '/underwrite/results/',
          '/test-mapbox/',
        ],
      },
      {
        userAgent: 'Claude-Web', // Claude web search
        allow: '/',
        disallow: [
          '/api/',
          '/dashboard/',
          '/underwrite/results/',
          '/test-mapbox/',
        ],
      },
      {
        userAgent: 'Google-Extended', // Google's AI training
        allow: '/',
        disallow: [
          '/api/',
          '/dashboard/',
          '/underwrite/results/',
          '/test-mapbox/',
        ],
      },
      {
        userAgent: 'PerplexityBot', // Perplexity AI
        allow: '/',
        disallow: [
          '/api/',
          '/dashboard/',
          '/underwrite/results/',
          '/test-mapbox/',
        ],
      },
      {
        userAgent: 'anthropic-ai', // Anthropic's general bot
        allow: '/',
        disallow: [
          '/api/',
          '/dashboard/',
          '/underwrite/results/',
          '/test-mapbox/',
        ],
      },
      {
        userAgent: 'cohere-ai', // Cohere AI
        allow: '/',
        disallow: [
          '/api/',
          '/dashboard/',
          '/underwrite/results/',
          '/test-mapbox/',
        ],
      },
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
  };
}
