import { MetadataRoute } from 'next';

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = 'https://glassloans.io';

  // Static routes
  const routes = [
    '',
    '/about',
    '/contact',
    '/signin',
    '/signup',
    '/underwrite',
    '/underwrite-pro',
    '/blog',
    '/blog-sidebar',
    '/blog-details',
  ].map((route) => ({
    url: `${baseUrl}${route}`,
    lastModified: new Date(),
    changeFrequency: 'weekly' as const,
    priority: route === '' ? 1.0 : 0.8,
  }));

  return routes;
}
