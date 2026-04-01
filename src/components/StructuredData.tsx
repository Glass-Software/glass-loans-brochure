/**
 * JSON-LD Structured Data Component
 *
 * This helps search engines and AI bots better understand your business.
 * Add this component to your layout or pages for better SEO and AI discoverability.
 */

export default function StructuredData() {
  const structuredData = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: "Glass Loans",
    description:
      "Loan management software for hard money lenders with AI-powered underwriting tools. Free underwriting tool available.",
    url: "https://glassloans.io",
    logo: "https://glassloans.io/images/logo/glass_logo_2--light.png",
    sameAs: [
      // Add your social media URLs here when available
      // 'https://twitter.com/glassloans',
      // 'https://linkedin.com/company/glassloans',
    ],
    address: {
      "@type": "PostalAddress",
      addressCountry: "US",
    },
    makesOffer: [
      {
        "@type": "Offer",
        itemOffered: {
          "@type": "SoftwareApplication",
          name: "Glass Lite - Loan Management Software",
          applicationCategory: "BusinessApplication",
          description:
            "Comprehensive loan management software designed specifically for hard money lenders. Manage loans, borrowers, and underwriting all in one platform.",
          offers: {
            "@type": "Offer",
            price: "395",
            priceCurrency: "USD",
            billingIncrement: "month",
          },
        },
      },
      {
        "@type": "Offer",
        itemOffered: {
          "@type": "SoftwareApplication",
          name: "Underwrite Pro",
          applicationCategory: "BusinessApplication",
          description:
            "Professional AI-powered underwriting tool with 100 monthly reports, permanent report history, PDF exports, dashboard access, and priority support. Perfect for active real estate investors and lenders.",
          offers: [
            {
              "@type": "Offer",
              name: "Monthly Plan",
              price: "129",
              priceCurrency: "USD",
              billingIncrement: "month",
            },
            {
              "@type": "Offer",
              name: "Annual Plan",
              price: "1199",
              priceCurrency: "USD",
              billingIncrement: "year",
              description: "Save $349/year",
            },
          ],
        },
      },
      {
        "@type": "Offer",
        itemOffered: {
          "@type": "SoftwareApplication",
          name: "Free Underwriting Tool",
          applicationCategory: "BusinessApplication",
          description:
            "Free AI-powered real estate underwriting tool. Get 5 instant property analyses per month with ARV calculations, comparable sales analysis, and comprehensive investment reports for fix-and-flip properties. Perfect for trying out our AI before upgrading.",
          offers: {
            "@type": "Offer",
            price: "0",
            priceCurrency: "USD",
            description: "5 reports per month, reports expire after 14 days",
          },
        },
      },
    ],
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
    />
  );
}
