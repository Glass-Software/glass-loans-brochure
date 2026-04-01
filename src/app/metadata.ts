import { Metadata } from 'next';

export const metadata: Metadata = {
  metadataBase: new URL('https://glassloans.io'),
  title: {
    default: 'Glass Loans - AI-Powered Real Estate Investment Analysis',
    template: '%s | Glass Loans',
  },
  description:
    'Glass Loans provides AI-powered real estate investment analysis and underwriting tools for fix-and-flip investors. Get instant property valuations, comparable sales analysis, and comprehensive investment reports.',
  keywords: [
    'real estate investing',
    'fix and flip',
    'property analysis',
    'AI underwriting',
    'real estate loans',
    'investment property',
    'ARV calculator',
    'comparable sales',
    'property valuation',
  ],
  authors: [{ name: 'Glass Loans' }],
  creator: 'Glass Loans',
  publisher: 'Glass Loans',
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: 'https://glassloans.io',
    siteName: 'Glass Loans',
    title: 'Glass Loans - AI-Powered Real Estate Investment Analysis',
    description:
      'AI-powered real estate investment analysis and underwriting tools for fix-and-flip investors.',
    images: [
      {
        url: '/images/logo/glass_logo_2--light.png',
        width: 1200,
        height: 630,
        alt: 'Glass Loans Logo',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Glass Loans - AI-Powered Real Estate Investment Analysis',
    description:
      'AI-powered real estate investment analysis and underwriting tools for fix-and-flip investors.',
    images: ['/images/logo/glass_logo_2--light.png'],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  verification: {
    // Add Google Search Console verification here when available
    // google: 'your-verification-code',
  },
};
